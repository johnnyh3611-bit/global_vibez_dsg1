'use client';

export const dynamic = "force-dynamic";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-50">
        <main className="flex min-h-screen items-center justify-center px-6 py-16">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur">
            <p className="text-sm uppercase tracking-[0.35em] text-zinc-400">
              Application error
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Something went wrong
            </h1>
            <p className="mt-4 text-sm leading-6 text-zinc-300">
              The app hit an unexpected error while rendering this page.
            </p>
            <p className="mt-6 break-words rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-400">
              {error.message}
            </p>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
              >
                Try again
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}