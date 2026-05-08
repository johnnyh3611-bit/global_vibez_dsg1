/**
 * WelcomeLetterModal — shown to chair holders the first time they hit
 * /chair-vault after activation. Body comes from /api/chairs/welcome-letter
 * so we can reword without a redeploy.
 *
 * Persists `welcome_letter_v1_seen` in localStorage so we don't nag.
 */
import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = "welcome_letter_v1_seen";

type Letter = {
  title: string;
  subtitle: string;
  body: string[];
  signoff: string;
};

const renderInline = (line: string) => {
  // Light markdown-ish bold support so the letter has visual hierarchy.
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="text-amber-300">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
};

export default function WelcomeLetterModal({
  hasChairs,
}: {
  hasChairs: boolean;
}) {
  const [letter, setLetter] = useState<Letter | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasChairs) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    fetch(`${API}/api/chairs/welcome-letter`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d) {
          setLetter(d);
          setOpen(true);
        }
      });
  }, [hasChairs]);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private browsing */
    }
  };

  if (!open || !letter) return null;

  return (
    <div
      data-testid="welcome-letter-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-8"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-gradient-to-br from-slate-900 via-zinc-900 to-black border-2 border-cyan-500/40 p-8"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          aria-label="Close welcome letter"
          data-testid="welcome-letter-dismiss"
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-400/30 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest text-amber-300">
            <Sparkles className="w-3 h-3" /> {letter.subtitle}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mt-3">
            {letter.title}
          </h1>
        </div>

        <div className="mt-6 space-y-3">
          {letter.body.map((line, i) =>
            line === "" ? (
              <div key={i} className="h-2" />
            ) : (
              <p
                key={i}
                className="text-[14px] text-slate-200 leading-relaxed"
              >
                {renderInline(line)}
              </p>
            ),
          )}
        </div>

        <p className="mt-6 text-[11px] text-slate-500 text-center">
          {letter.signoff}
        </p>

        <button
          onClick={dismiss}
          data-testid="welcome-letter-cta"
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-400 via-rose-500 to-fuchsia-500 px-4 py-3 text-sm font-black uppercase tracking-widest text-black hover:brightness-110"
        >
          Take me to my Genius Kit
        </button>
      </div>
    </div>
  );
}
