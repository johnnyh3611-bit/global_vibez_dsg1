// Vibez Rewards — on-chain $VIBEZ mint program (Anchor).
//
// Deploys to Solana devnet/mainnet. Only the registered God-Mode
// admin signer can issue rewards; players receive minted $VIBEZ
// directly into their associated token account.
//
// Build & deploy:
//   anchor build
//   solana-keygen new -o target/deploy/vibez_rewards-keypair.json
//   anchor deploy --provider.cluster devnet
//
// Then update the Python backend env vars:
//   VIBEZ_TOKEN_MINT_ADDRESS=<your $VIBEZ mint pubkey>
//   VIBEZ_TREASURY_SECRET=<base58 admin secret key>
//   VIBEZ_PAYOUT_NETWORK=devnet
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{mint_to, Mint, MintTo, TokenAccount, TokenInterface};

declare_id!("Vibez1111111111111111111111111111111111111");

#[program]
pub mod vibez_rewards {
    use super::*;

    pub fn issue_reward(ctx: Context<IssueReward>, amount: u64) -> Result<()> {
        let cpi_accounts = MintTo {
            mint: ctx.accounts.vibez_mint.to_account_info(),
            to: ctx.accounts.player_token_account.to_account_info(),
            authority: ctx.accounts.god_mode_admin.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        mint_to(cpi_ctx, amount)?;
        msg!("Reward of {} $VIBEZ issued to player!", amount);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct IssueReward<'info> {
    #[account(mut)]
    pub vibez_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub player_token_account: InterfaceAccount<'info, TokenAccount>,
    /// Only the registered admin key can sign this instruction.
    pub god_mode_admin: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}
