import Link from "next/link";
import { HapticButton } from "@/components/ui/HapticButton";

export default function Home() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-background-deep text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(124,58,237,0.35),transparent_60%)]" />

      <video
        src="/landing-tour-tiktok-en-9x16.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/80" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur">
          Dating · Streaming · Gaming
        </div>

        <h1 className="text-5xl font-bold tracking-tight drop-shadow-lg sm:text-7xl">
          Global <span className="text-brand-accent">Vibez DSG</span>
        </h1>

        <p className="mt-4 max-w-xl text-base text-white/80 drop-shadow sm:text-lg">
          One wallet. Every vibe. Connect, stream, and play — all on-chain.
        </p>

        <div className="mt-10">
          <Link href="/games">
            <HapticButton haptic="success" variant="primary">
              Enter Global Vibez DSG
            </HapticButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
