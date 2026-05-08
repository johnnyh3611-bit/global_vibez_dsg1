// SPDX-License-Identifier: Apache-2.0
//
// VibeRidez Fare Splitter — Anchor program.
//
// Mirrors the off-chain canonical splitter at
// `backend/routes/viberidez_fare_split.py`. The percentages here are
// the SAME source-of-truth math; if you change them in one place you
// MUST change them in the other (and re-audit). A unit test on the
// off-chain side asserts the maps total exactly 1.0; a parallel
// `assert_eq!` block at the bottom of this file does the same for
// basis-point math.
//
// On-chain responsibilities (post-deploy):
//   1. Receive a `total_fare` USDC SPL transfer from the rider.
//   2. Split it across 5 PDAs (driver, chair pool, platform, insurance,
//      referrer) using the active split (pre-EV vs post-EV).
//   3. Emit a `FareDistributed` event with all per-bucket amounts.
//   4. Replay-protect via a per-ride PDA (`fare_dist_v1` || ride_id).
//
// NOT YET DEPLOYED. Off-chain splitter remains source of truth until
// audit + Squads multisig sign-off complete.

use anchor_lang::prelude::*;

declare_id!("ViBeRiDeZFareSplitter11111111111111111111111");

// Basis points — 10_000 = 100%. Avoids float math entirely on-chain.
// Pre-Escape Velocity ───────────────────────────────────────────────
const BPS_PRE_DRIVER:    u16 = 7_000;  // 70.0%
const BPS_PRE_CHAIR:     u16 =   1_400;  // 14.0%
const BPS_PRE_PLATFORM:  u16 =     850;  //  8.5%
const BPS_PRE_INSURANCE: u16 =     500;  //  5.0%
const BPS_PRE_REFERRAL:  u16 =     250;  //  2.5%
// Post-Escape Velocity ──────────────────────────────────────────────
const BPS_POST_DRIVER:    u16 = 7_000;  // 70.0%
const BPS_POST_CHAIR:     u16 = 3_000;  // 30.0%
const BPS_POST_PLATFORM:  u16 =     0;
const BPS_POST_INSURANCE: u16 =     0;
const BPS_POST_REFERRAL:  u16 =     0;
const BPS_TOTAL: u16 = 10_000;

// Compile-time assertion that every split map totals 100%.
const _: () = {
    assert!(
        BPS_PRE_DRIVER + BPS_PRE_CHAIR + BPS_PRE_PLATFORM
            + BPS_PRE_INSURANCE + BPS_PRE_REFERRAL == BPS_TOTAL,
        "pre-EV bps must total 10000"
    );
    assert!(
        BPS_POST_DRIVER + BPS_POST_CHAIR + BPS_POST_PLATFORM
            + BPS_POST_INSURANCE + BPS_POST_REFERRAL == BPS_TOTAL,
        "post-EV bps must total 10000"
    );
};

#[program]
pub mod viberidez_fare_splitter {
    use super::*;

    /// Distribute a completed ride's fare across the 5 buckets.
    ///
    /// Caller must have already transferred `total_fare` USDC to the
    /// program's escrow ATA (handled in the calling tx via SPL
    /// `transfer` ix).
    ///
    /// Replay protection: `FareDistribution` PDA seeded by `ride_id`.
    /// Second call for the same ride_id will fail with `AccountAlreadyInUse`.
    pub fn distribute_fare(
        ctx: Context<DistributeFare>,
        ride_id: String,
        total_fare: u64,
        post_escape_velocity: bool,
    ) -> Result<()> {
        require!(!ride_id.is_empty(), FareError::InvalidRideId);
        require!(ride_id.len() <= 64, FareError::InvalidRideId);
        require!(total_fare > 0, FareError::InvalidAmount);

        let (
            bps_driver, bps_chair, bps_platform, bps_insurance, bps_referral,
        ) = if post_escape_velocity {
            (BPS_POST_DRIVER, BPS_POST_CHAIR, BPS_POST_PLATFORM,
             BPS_POST_INSURANCE, BPS_POST_REFERRAL)
        } else {
            (BPS_PRE_DRIVER, BPS_PRE_CHAIR, BPS_PRE_PLATFORM,
             BPS_PRE_INSURANCE, BPS_PRE_REFERRAL)
        };

        // Use u128 mid-math to avoid overflow at u64::MAX × 10000.
        let calc = |bps: u16| -> u64 {
            ((total_fare as u128) * (bps as u128) / (BPS_TOTAL as u128)) as u64
        };
        let mut driver_amt    = calc(bps_driver);
        let chair_amt    = calc(bps_chair);
        let platform_amt = calc(bps_platform);
        let insurance_amt = calc(bps_insurance);
        let referral_amt  = calc(bps_referral);

        // Reconcile rounding drift back into the driver bucket so the
        // sum exactly equals total_fare. Driver gets at most 4 lamports
        // extra — negligible. Same convention as the off-chain splitter.
        let summed = driver_amt
            .saturating_add(chair_amt)
            .saturating_add(platform_amt)
            .saturating_add(insurance_amt)
            .saturating_add(referral_amt);
        if summed < total_fare {
            driver_amt = driver_amt.saturating_add(total_fare - summed);
        }

        // Persist + emit. Token transfers happen in calling tx via CPI;
        // splitting them out keeps this program token-agnostic for now.
        let dist = &mut ctx.accounts.fare_distribution;
        dist.ride_id = ride_id.clone();
        dist.total_fare = total_fare;
        dist.driver_amt = driver_amt;
        dist.chair_amt = chair_amt;
        dist.platform_amt = platform_amt;
        dist.insurance_amt = insurance_amt;
        dist.referral_amt = referral_amt;
        dist.post_escape_velocity = post_escape_velocity;
        dist.created_at = Clock::get()?.unix_timestamp;

        emit!(FareDistributed {
            ride_id, total_fare, driver_amt, chair_amt, platform_amt,
            insurance_amt, referral_amt, post_escape_velocity,
        });
        Ok(())
    }
}

// ──────────────────────────────────────────────────────────────── Accounts

#[derive(Accounts)]
#[instruction(ride_id: String)]
pub struct DistributeFare<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = FareDistribution::LEN,
        seeds = [b"fare_dist_v1", ride_id.as_bytes()],
        bump,
    )]
    pub fare_distribution: Account<'info, FareDistribution>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct FareDistribution {
    pub ride_id: String,
    pub total_fare: u64,
    pub driver_amt: u64,
    pub chair_amt: u64,
    pub platform_amt: u64,
    pub insurance_amt: u64,
    pub referral_amt: u64,
    pub post_escape_velocity: bool,
    pub created_at: i64,
}

impl FareDistribution {
    // 8 (disc) + 4+64 (string) + 6*8 (u64) + 1 (bool) + 8 (i64) = 133. Pad to 200.
    pub const LEN: usize = 200;
}

// ──────────────────────────────────────────────────────────────── Events

#[event]
pub struct FareDistributed {
    pub ride_id: String,
    pub total_fare: u64,
    pub driver_amt: u64,
    pub chair_amt: u64,
    pub platform_amt: u64,
    pub insurance_amt: u64,
    pub referral_amt: u64,
    pub post_escape_velocity: bool,
}

// ──────────────────────────────────────────────────────────────── Errors

#[error_code]
pub enum FareError {
    #[msg("ride_id is empty or too long (max 64 chars)")]
    InvalidRideId,
    #[msg("total_fare must be > 0")]
    InvalidAmount,
}

// ──────────────────────────────────────────────────────────────── Tests
#[cfg(test)]
mod tests {
    use super::*;

    fn split(total: u64, post_ev: bool) -> (u64, u64, u64, u64, u64) {
        let (b1, b2, b3, b4, b5) = if post_ev {
            (BPS_POST_DRIVER, BPS_POST_CHAIR, BPS_POST_PLATFORM,
             BPS_POST_INSURANCE, BPS_POST_REFERRAL)
        } else {
            (BPS_PRE_DRIVER, BPS_PRE_CHAIR, BPS_PRE_PLATFORM,
             BPS_PRE_INSURANCE, BPS_PRE_REFERRAL)
        };
        let c = |bps: u16| ((total as u128) * (bps as u128) / 10_000u128) as u64;
        let mut d = c(b1); let ch = c(b2); let p = c(b3); let i = c(b4); let r = c(b5);
        let sum = d + ch + p + i + r;
        if sum < total { d += total - sum; }
        (d, ch, p, i, r)
    }

    #[test]
    fn pre_ev_10_usdc_splits_exactly() {
        // 10 USDC = 10_000_000 (6 decimals).
        let (d, c, p, i, r) = split(10_000_000, false);
        assert_eq!(d, 7_000_000);
        assert_eq!(c, 1_400_000);
        assert_eq!(p,   850_000);
        assert_eq!(i,   500_000);
        assert_eq!(r,   250_000);
        assert_eq!(d + c + p + i + r, 10_000_000);
    }

    #[test]
    fn post_ev_10_usdc_splits_exactly() {
        let (d, c, p, i, r) = split(10_000_000, true);
        assert_eq!(d, 7_000_000);
        assert_eq!(c, 3_000_000);
        assert_eq!(p, 0);
        assert_eq!(i, 0);
        assert_eq!(r, 0);
        assert_eq!(d + c + p + i + r, 10_000_000);
    }

    #[test]
    fn rounding_drift_credits_driver() {
        // 7 lamports — too small to split cleanly. Driver should
        // absorb the drift and the total must still match exactly.
        let (d, c, p, i, r) = split(7, false);
        assert_eq!(d + c + p + i + r, 7);
    }
}
