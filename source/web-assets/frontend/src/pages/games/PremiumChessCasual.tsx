/**
 * /chess/casual — GameRoomLayout premium chess with takebacks, themes,
 * mute, and emoji rail (dating / social companion mode).
 */
import PremiumChessRoom from "@/components/chess/PremiumChessRoom";

export default function PremiumChessCasual() {
  return (
    <PremiumChessRoom
      title="Chess · Casual"
      subtitle="Takebacks on · material themes · reaction rail"
      mode="casual"
      socialRail
      backTo="/chess-hall"
      testId="premium-chess-casual"
    />
  );
}
