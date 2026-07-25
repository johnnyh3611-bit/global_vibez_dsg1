# Card Physics & Layout Engine

Shared primitives so every AAA card room matches Spades / Bid Whist feel.

## Imports

```ts
import {
  BaseCardGameRoom,
  HandFan,
  CardActionTray,
  useCardSelection,
  usePlaySequence,
  calculateHandArcLayout,
  sortHand,
  AnimatedCard,
} from "@/components/shared/cards";
```

## Pieces

| Export | Role |
|--------|------|
| `calculateHandArcLayout` | Arc angle + overlap math (−12°…+12°) |
| `sortHand` / `groupByMeld` | Suit sort vs Gin/Rummy meld groups |
| `HandFan` | Deal-in motion + play / select modes |
| `useCardSelection` | `single` (trick) or `multi` (pass/kitty) |
| `usePlaySequence` | 850ms / 1200ms trick staging |
| `CardActionTray` | Phase-aware Pass → Draw → Play → Score bar |
| `BaseCardGameRoom` | `GameRoomLayout` + tray conventions |
| `AnimatedCard` | Canonical SpadesCard face |

## Adopt a room

1. Wrap game phase in `BaseCardGameRoom`.
2. Put felt in `table`, `HandFan` in `hand`, phase buttons in `phaseActions`.
3. Trick-takers: `usePlaySequence` for `play_sequence` staging.
4. Pass / kitty / discard: `useCardSelection`.

`SpadesHandFan` is a thin adapter over `HandFan` (legacy import path kept).
