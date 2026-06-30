import { brand, glassStyle, glassStyleStrong } from "@/styles/design-tokens";

export const metadata = {
  title: "Global Vibez DSG — Design System",
};

const colors = [
  { name: "brand-primary", className: "bg-brand-primary", hex: "#7c3aed" },
  { name: "brand-primary-hover", className: "bg-brand-primary-hover", hex: "#6d28d9" },
  { name: "brand-accent", className: "bg-brand-accent", hex: "#a78bfa" },
  { name: "brand-glow", className: "bg-brand-glow", hex: "#c4b5fd" },
  { name: "background-deep", className: "bg-background-deep", hex: "#0f172a" },
  { name: "background-abyss", className: "bg-background-abyss", hex: "#050508" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="w-full">
      <h2 className="mb-4 text-lg font-semibold text-white sm:text-xl">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen w-full bg-background-deep px-4 py-10 text-white sm:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-accent">
            Visual contract
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Global <span className="text-brand-accent">Vibez</span> Design System
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/60">
            Deep Violet &amp; Glass. Every component pulls from these tokens
            (defined in <code className="text-brand-glow">globals.css</code>{" "}
            <code className="text-brand-glow">@theme</code>).
          </p>
        </header>

        <Section title="Palette">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {colors.map((c) => (
              <div key={c.name} className={`${glassStyle} p-3`}>
                <div className={`${c.className} h-16 w-full rounded-lg border border-white/10`} />
                <p className="mt-2 text-xs font-medium">{c.name}</p>
                <p className="text-xs text-white/50">{c.hex}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Glass surfaces & layered depth">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={`${glassStyle} p-6`}>
              <p className="text-sm font-semibold">glassStyle</p>
              <p className="mt-1 text-xs text-white/60">
                backdrop-blur-md · bg-surface-glass · shadow-glass · rounded-glass
              </p>
            </div>
            <div className={`${glassStyleStrong} p-6`}>
              <p className="text-sm font-semibold">glassStyleStrong</p>
              <p className="mt-1 text-xs text-white/60">
                elevated surface · shadow-glass-lg
              </p>
            </div>
          </div>
        </Section>

        <Section title="Buttons (44px touch targets)">
          <div className="flex flex-wrap gap-4">
            <button className={brand.button}>Enter Global Vibez DSG</button>
            <button className={brand.buttonGhost}>Secondary</button>
            <button className={brand.button} disabled>
              Disabled
            </button>
          </div>
        </Section>

        <Section title="Radius & shadow tokens">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-glass bg-surface-glass p-6 text-xs">rounded-glass (16px)</div>
            <div className="rounded-glass bg-surface-glass p-6 text-xs shadow-glass">shadow-glass</div>
            <div className="rounded-glass bg-surface-glass p-6 text-xs shadow-brand-glow">
              shadow-brand-glow
            </div>
          </div>
        </Section>
      </div>
    </main>
  );
}
