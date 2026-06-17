# Multi-Human QA Checklist — All 11 AAA Rooms

> Created 2026-02-06 to support the **P1 Multi-human QA** task. The
> **automated** stand-in (`backend/tests/test_vibe_room_signaling.py::
> test_three_concurrent_peers_room`) covers the WebSocket signaling
> layer with 3 concurrent peers, but **camera/microphone/UX flows still
> need real human testers**. Use this checklist with 2-3 testers (can
> be distributed across 2 phones + 1 desktop) per room.

## Setup once

1. Each tester goes to `https://social-connect-953.preview.emergentagent.com/`
2. Click **Demo Login** (or use seeded test accounts from
   `/app/memory/test_credentials.md`)
3. Note: every demo login creates the SAME user (`demo@globalvibez.com`).
   For multi-human testing, the founder must seed 2-3 unique guest
   accounts via the Vibe Vault Admin (`/vibe-vault-admin`, password
   `GlobalVibez_Founder_2025!`).

## Core acceptance criteria (every room)

- [ ] All testers see the **same RoomMenuBar** at the top (theme-coloured)
- [ ] Each tester's name and seat appears for the others within 3s of
      joining
- [ ] No horizontal scroll on mobile 390×844
- [ ] Vibe Room voice bar (`data-testid="vibe-room-voice"`) shows
      **N/20** badge updating live
- [ ] Mic toggle works; the speaker pulse highlights the talker on every
      other tester's screen
- [ ] Video toggle works; remote tile transitions from letter-avatar
      to live `<video>` within ~3s (firewall permitting STUN; may fail
      on symmetric NATs without TURN — known limitation)
- [ ] Disconnect (close tab) → other testers see the seat empty within 3s
- [ ] Privy console spam is **gone** (open DevTools console — no
      `TypeError: e is not a function`, no CSP frame-ancestors 403)

## Per-room rooms checklist

| # | Room | Key flow to verify |
|---|------|-------------------|
| 1 | `/spades` | 4 testers — bidding round → trick play → score breakdown |
| 2 | `/hearts` | 4 testers — pass 3 cards → moon-shooting attempt |
| 3 | `/bid-whist` | 4 testers — bidding (incl. pass) → kitty exchange |
| 4 | `/pinochle` | 4 testers — bidding → trump → meld scoring |
| 5 | `/euchre` | 4 testers — order-up → trump → "going alone" |
| 6 | `/rummy` | 2-4 testers — meld + lay-off → discard |
| 7 | `/gin-rummy` | 2 testers — knock with deadwood ≤ 10 → undercut |
| 8 | `/crazy-eights` | 2-4 testers — wild 8 colour-change → win-by-emptying |
| 9 | `/go-fish` | 2-4 testers — ask + go-fish + book scoring |
| 10 | `/war` | 2 testers — tie → war stack → ace-as-high resolution |
| 11 | `/uno` | 2-4 testers — Skip / Reverse / Wild +4 |

For each, also verify:

- [ ] AI seats fill if not enough humans join within 30s
- [ ] Tip animation fires on every tester's screen when one tips
- [ ] Win-celebration explosion plays on the winner's screen + others
      see it through the Coliseum/Arena overlay
- [ ] Re-entering the room after a refresh restores game state + seat

## Vibe 6-5-4 specific (Coliseum + Solo Vault + /dice)

- [ ] Solo Vault: SideDockDecision auto-hides when no game is active
- [ ] Solo Vault: 5-dice tray on a 390px viewport doesn't wrap
- [ ] Coliseum: live qualifier chips (6/5/4) light cyan when round
      reports `hit_654`
- [ ] Coliseum: tiny dice + "Round X · Pot ₵Y" label updates after each orbit
- [ ] Standalone /dice: betting flow accepts ₵25 main bet → spin → debit
- [ ] All three: no body-level scroll on 100dvh

## Reporting bugs

Open issues in `/app/memory/REGRESSION_LOCK.md` with:
- Date / room / repro steps
- Browser + device
- Console errors (paste)
- Whether voice/video was on or off

Founder-confirmed regressions should be added as a permanent
`test_*` lock in `regression_shield.py` so future agents can't
silently break them again.
