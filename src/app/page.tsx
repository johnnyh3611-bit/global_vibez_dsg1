import Link from "next/link";

export default function Home() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-background-deep text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(124,58,237,0.35),transparent_60%)]" />

      <video
        src="/intro.mp4"
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
          Global <span className="text-violet-400">Vibez</span>
        </h1>

        <p className="mt-4 max-w-xl text-lg text-white/80 drop-shadow">
          One wallet. Every vibe. Connect, stream, and play — all on-chain.
        </p>

        <Link
          href="/login"
          className="mt-10 rounded-full bg-violet-600 px-10 py-4 text-base font-semibold text-white shadow-[0_0_40px_rgba(124,58,237,0.5)] transition-all hover:scale-105 hover:bg-violet-500"
        >
          Enter Global Vibez
        </Link>
      </div>
    </div>
  );
}
