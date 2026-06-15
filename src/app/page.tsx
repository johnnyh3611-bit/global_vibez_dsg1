import Link from "next/link";

export default function Home() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white">
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
          Global <span className="text-brand-accent">Vibez</span>
        </h1>

        <p className="mt-4 max-w-xl text-base text-white/80 drop-shadow sm:text-lg">
          One wallet. Every vibe. Connect, stream, and play — all on-chain.
        </p>

        <Link
          href="/login"
          className="mt-10 inline-flex min-h-11 items-center justify-center rounded-full bg-brand-primary px-10 py-4 text-base font-semibold text-white shadow-brand-glow transition-all hover:scale-105 hover:bg-brand-primary-hover"
        >
          Enter Global Vibez
        </Link>
      </div>
    </div>
  );
}
