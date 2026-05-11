/**
 * HungryVibes Merchant Dashboard.
 *
 * Implements both PDFs uploaded Feb 2, 2026:
 *  • GlobalVibez_HungryVibes_Merchant_Dashboard.pdf
 *  • GlobalVibez_Merchant_Promo_System.pdf
 *
 * Three tabs:
 *  1. MENU — Menu & Ingredient Builder. Add item w/ base_price; add
 *     ingredient extras; Inventory Toggle flips an ingredient's
 *     availability instantly.
 *  2. PROMOS — VIBE PROMOS Hub. Create code (uppercase, fixed/percent),
 *     Live Tracker (uses_today vs uses_remaining/limit), Flash-Sale
 *     Toggle to instantly activate/deactivate.
 *  3. VIBE ACCOUNT — Revenue Pipeline view. Balance + recent ledger
 *     entries (gross → vibe-tax 2% → net credit). Includes a "Test
 *     Settlement" CTA so the owner can simulate an order being settled.
 *
 * Backend: /api/hungryvibes/merchant/*
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChefHat,
  Coins,
  Loader2,
  Plus,
  Power,
  Sparkles,
  Tag,
  Trash2,
  Utensils,
  Wallet,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type TabKey = "menu" | "orders" | "promos" | "vibe";

interface Merchant {
  merchant_id: string;
  owner_user_id: string;
  name: string;
  description?: string | null;
  cuisine?: string | null;
  address?: string | null;
  open_now: boolean;
  sponsorship_active: boolean;
  vibe_account_balance: number;
  created_at: string;
}

interface Ingredient {
  name: string;
  price: number;
  available: boolean;
}

interface MenuItem {
  item_id: string;
  merchant_id: string;
  item_name: string;
  base_price: number;
  custom_ingredients: Ingredient[];
  available: boolean;
}

interface Promo {
  promo_id: string;
  merchant_id: string;
  code: string;
  discount_value: number;
  is_percent: boolean;
  limit: number;
  uses_remaining: number;
  uses_today: number;
  active: boolean;
}

interface LedgerEntry {
  ledger_id: string;
  order_id: string;
  gross: number;
  vibe_tax: number;
  net_credit: number;
  kind: string;
  created_at: string;
}

interface VibeAccount {
  balance: number;
  vibe_tax_rate: number;
  ledger: LedgerEntry[];
}

export default function HungryVibesMerchant() {
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [needsRegister, setNeedsRegister] = useState(false);
  const [tab, setTab] = useState<TabKey>("menu");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [vibeAccount, setVibeAccount] = useState<VibeAccount | null>(null);

  const loadMerchant = useCallback(async () => {
    const res = await authFetch(`${API}/api/hungryvibes/merchant/me`);
    if (res.status === 404) {
      setNeedsRegister(true);
      return;
    }
    if (!res.ok) {
      toast.error("Couldn't load merchant profile");
      return;
    }
    const data = await res.json();
    setMerchant(data.merchant);
    setNeedsRegister(false);
  }, []);

  const loadMenu = useCallback(async () => {
    const res = await authFetch(`${API}/api/hungryvibes/merchant/menu`);
    if (res.ok) setMenu((await res.json()).items ?? []);
  }, []);

  const loadPromos = useCallback(async () => {
    const res = await authFetch(`${API}/api/hungryvibes/merchant/promos`);
    if (res.ok) setPromos((await res.json()).promos ?? []);
  }, []);

  const loadVibe = useCallback(async () => {
    const res = await authFetch(`${API}/api/hungryvibes/merchant/vibe-account`);
    if (res.ok) setVibeAccount(await res.json());
  }, []);

  // ─── Sponsorship checkout flow ────────────────────────────────────
  // On return from Stripe the URL has ?sponsorship_session=cs_xxx. We
  // hit /sponsorship/verify to flip sponsorship_active + show a toast.
  useEffect(() => {
    if (!merchant) return;
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("sponsorship_session");
    const cancelled = params.get("sponsorship_cancelled");
    if (cancelled) {
      toast.info("Sponsorship not subscribed");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (sid) {
      // Strip the query string immediately so a refresh doesn't re-verify.
      window.history.replaceState({}, "", window.location.pathname);
      (async () => {
        const res = await authFetch(`${API}/api/hungryvibes/merchant/sponsorship/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sid }),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success("Sponsorship active — thank you!");
          await loadMerchant();
        } else {
          toast.error(data.detail ?? "Verification failed");
        }
      })();
    }
  }, [merchant, loadMerchant]);

  const startCheckout = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/hungryvibes/merchant/sponsorship/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? "Stripe not available");
        return;
      }
      window.location.assign(data.checkout_url);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadMerchant();
  }, [loadMerchant]);

  useEffect(() => {
    if (!merchant) return;
    void loadMenu();
    void loadPromos();
    void loadVibe();
  }, [merchant, loadMenu, loadPromos, loadVibe]);

  // ─── Register flow ────────────────────────────────────────────────
  if (needsRegister) {
    return (
      <RegisterScreen
        onRegistered={(m) => {
          setMerchant(m);
          setNeedsRegister(false);
          toast.success("Merchant profile created");
        }}
        onBack={() => navigate(-1)}
      />
    );
  }

  if (!merchant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08081a] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-amber-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0814] via-[#150b22] to-[#08051a] text-white" data-testid="hungryvibes-merchant">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {/* Header */}
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1.5 text-amber-200/70 hover:text-white transition text-xs font-bold mb-3"
          data-testid="hv-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>
        <div className="flex items-center gap-4 mb-7">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 shadow-[0_0_30px_rgba(245,158,11,0.45)]">
            <ChefHat className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300/80 font-bold" style={{ fontFamily: "'Cinzel', serif" }}>
              HungryVibes · Merchant Dashboard
            </p>
            <h1 className="text-2xl md:text-3xl font-black leading-tight" style={{ fontFamily: "'Cinzel', serif" }}>
              {merchant.name}
            </h1>
            <p className="text-xs text-amber-100/60 mt-0.5">
              {merchant.cuisine ?? "Restaurant"} ·{" "}
              <span className={merchant.open_now ? "text-emerald-300" : "text-rose-300"}>
                {merchant.open_now ? "Open now" : "Closed"}
              </span>{" "}
              · Sponsorship {merchant.sponsorship_active ? "ACTIVE" : "$29.99/mo — inactive"}
            </p>
          </div>
        </div>

        {/* Sponsorship banner — visible when inactive. Becomes a small
            green "ACTIVE · renews on …" pill when subscribed. */}
        {!merchant.sponsorship_active ? (
          <div className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-rose-500/15 border border-amber-400/40 flex flex-wrap items-center gap-4 justify-between" data-testid="hv-sponsorship-banner">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300 font-bold mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                HungryVibes Sponsorship
              </p>
              <p className="text-sm text-amber-100">
                Unlock featured placement, priority promo slots, and the full Vibe Account analytics. <strong className="text-amber-200">$29.99/mo flat</strong> — cancel anytime.
              </p>
            </div>
            <button
              onClick={startCheckout}
              disabled={busy}
              data-testid="hv-sponsorship-subscribe-btn"
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 hover:to-rose-500 text-[#1a0d05] font-black text-xs uppercase tracking-widest shadow-[0_0_18px_rgba(245,158,11,0.45)] disabled:opacity-50"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {busy ? "Loading…" : "Subscribe · $29.99/mo"}
            </button>
          </div>
        ) : (
          <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-between" data-testid="hv-sponsorship-active">
            <p className="text-emerald-300 text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Sponsorship active
            </p>
            <p className="text-emerald-200/70 text-xs">$29.99/mo · auto-renews</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto" data-testid="hv-tabs">
          <TabButton active={tab === "menu"} onClick={() => setTab("menu")} icon={<Utensils className="w-4 h-4" />} label="Menu Builder" testId="hv-tab-menu" />
          <TabButton active={tab === "orders"} onClick={() => setTab("orders")} icon={<ClipboardList className="w-4 h-4" />} label="Orders" testId="hv-tab-orders" />
          <TabButton active={tab === "promos"} onClick={() => setTab("promos")} icon={<Tag className="w-4 h-4" />} label="VIBE Promos" testId="hv-tab-promos" />
          <TabButton active={tab === "vibe"} onClick={() => setTab("vibe")} icon={<Wallet className="w-4 h-4" />} label="Vibe Account" testId="hv-tab-vibe" />
        </div>

        {/* Tab body */}
        {tab === "menu" ? (
          <MenuTab
            items={menu}
            busy={busy}
            setBusy={setBusy}
            reload={loadMenu}
          />
        ) : tab === "orders" ? (
          <OrdersTab onSettlementCredit={async () => { await loadVibe(); await loadMerchant(); }} />
        ) : tab === "promos" ? (
          <PromosTab promos={promos} busy={busy} setBusy={setBusy} reload={loadPromos} />
        ) : (
          <VibeAccountTab account={vibeAccount} busy={busy} setBusy={setBusy} onSettle={async () => { await loadVibe(); await loadMerchant(); }} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap transition ${
        active
          ? "bg-gradient-to-r from-amber-400 to-orange-500 text-[#1a0d05] shadow-[0_0_18px_rgba(245,158,11,0.5)]"
          : "bg-white/5 text-amber-100/70 hover:bg-white/10"
      }`}
      style={{ fontFamily: "'Cinzel', serif" }}
    >
      {icon}
      {label}
    </button>
  );
}

function RegisterScreen({
  onRegistered,
  onBack,
}: {
  onRegistered: (m: Merchant) => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState({ name: "", description: "", cuisine: "" });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/hungryvibes/merchant/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? "Failed");
        return;
      }
      onRegistered(data.merchant);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08081a] text-white px-4 py-8">
      <div className="max-w-md mx-auto">
        <button onClick={onBack} className="text-amber-200/70 text-xs font-bold mb-4 flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-rose-600 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.5)]">
            <ChefHat className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300 font-bold" style={{ fontFamily: "'Cinzel', serif" }}>
              HungryVibes · Onboarding
            </p>
            <h1 className="text-2xl font-black" style={{ fontFamily: "'Cinzel', serif" }}>Register Restaurant</h1>
          </div>
        </div>
        <div className="space-y-3 p-5 rounded-2xl bg-white/[0.03] border border-amber-400/20" data-testid="hv-register-form">
          <Field label="Restaurant name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testId="hv-reg-name" placeholder="Mom's Bistro" />
          <Field label="Cuisine" value={form.cuisine} onChange={(v) => setForm({ ...form, cuisine: v })} testId="hv-reg-cuisine" placeholder="Italian / Soul Food / Mexican…" />
          <Field label="Short description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} testId="hv-reg-desc" placeholder="What makes you special?" />
          <button
            onClick={submit}
            disabled={busy}
            data-testid="hv-reg-submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:to-rose-500 text-[#1a0d05] font-black uppercase tracking-widest text-sm shadow-[0_0_22px_rgba(245,158,11,0.45)] disabled:opacity-50"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {busy ? "Creating…" : "Open My Storefront"}
          </button>
          <p className="text-[11px] text-amber-100/50 text-center pt-2">
            $29.99/mo flat sponsorship · Pay later from the Vibe Account tab.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  testId,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-amber-300/70 font-bold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className="mt-1 w-full px-3 py-2 rounded-lg bg-black/40 border border-amber-400/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400"
      />
    </label>
  );
}

// ─── MENU TAB ─────────────────────────────────────────────────────────

function MenuTab({
  items,
  busy,
  setBusy,
  reload,
}: {
  items: MenuItem[];
  busy: boolean;
  setBusy: (b: boolean) => void;
  reload: () => Promise<void>;
}) {
  const [newItem, setNewItem] = useState({ item_name: "", base_price: "" });
  const [ingDraft, setIngDraft] = useState<Record<string, { name: string; cost: string }>>({});

  const addItem = async () => {
    if (!newItem.item_name.trim() || !newItem.base_price) return toast.error("Fill both fields");
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/hungryvibes/merchant/menu`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: newItem.item_name,
          base_price: parseFloat(newItem.base_price),
        }),
      });
      if (!res.ok) {
        toast.error((await res.json()).detail ?? "Failed");
        return;
      }
      toast.success("Added");
      setNewItem({ item_name: "", base_price: "" });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const addIng = async (item: MenuItem) => {
    const draft = ingDraft[item.item_id];
    if (!draft?.name.trim() || !draft?.cost) return toast.error("Name + cost required");
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/hungryvibes/merchant/menu/${item.item_id}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          extra_cost: parseFloat(draft.cost),
        }),
      });
      if (!res.ok) {
        toast.error((await res.json()).detail ?? "Failed");
        return;
      }
      setIngDraft({ ...ingDraft, [item.item_id]: { name: "", cost: "" } });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const toggleIng = async (item: MenuItem, ingName: string) => {
    setBusy(true);
    try {
      const res = await authFetch(
        `${API}/api/hungryvibes/merchant/menu/${item.item_id}/ingredients/${encodeURIComponent(ingName)}`,
        { method: "PATCH" },
      );
      if (!res.ok) toast.error("Failed");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (item: MenuItem) => {
    if (!window.confirm(`Delete ${item.item_name}?`)) return;
    setBusy(true);
    try {
      await authFetch(`${API}/api/hungryvibes/merchant/menu/${item.item_id}`, { method: "DELETE" });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = async (item: MenuItem) => {
    setBusy(true);
    try {
      await authFetch(`${API}/api/hungryvibes/merchant/menu/${item.item_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available }),
      });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="hv-menu-tab">
      {/* Add new item */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-amber-400/20 flex flex-col md:flex-row gap-2">
        <input
          type="text"
          value={newItem.item_name}
          onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
          placeholder="Dish name (e.g. Margherita Pizza)"
          data-testid="hv-menu-new-name"
          className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-amber-400/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400"
        />
        <input
          type="number"
          step="0.01"
          value={newItem.base_price}
          onChange={(e) => setNewItem({ ...newItem, base_price: e.target.value })}
          placeholder="Base price"
          data-testid="hv-menu-new-price"
          className="md:w-40 px-3 py-2 rounded-lg bg-black/40 border border-amber-400/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400"
        />
        <button
          onClick={addItem}
          disabled={busy}
          data-testid="hv-menu-new-add"
          className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-[#1a0d05] font-black text-xs uppercase tracking-widest disabled:opacity-50 inline-flex items-center gap-1.5 justify-center"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center text-amber-100/50 py-8 text-sm" data-testid="hv-menu-empty">
          Build your first dish above.
        </div>
      ) : (
        items.map((item) => (
          <div key={item.item_id} className="p-4 rounded-2xl bg-white/[0.03] border border-amber-400/15" data-testid={`hv-menu-item-${item.item_id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  {item.item_name}
                  {!item.available ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 uppercase tracking-wider">Hidden</span>
                  ) : null}
                </h3>
                <p className="text-xs text-amber-200/70">Base price · ${item.base_price.toFixed(2)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => togglePublished(item)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-amber-200"
                  title={item.available ? "Hide" : "Publish"}
                  data-testid={`hv-menu-toggle-${item.item_id}`}
                >
                  <Power className={`w-4 h-4 ${item.available ? "text-emerald-400" : "text-rose-400"}`} />
                </button>
                <button
                  onClick={() => removeItem(item)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 text-rose-300"
                  title="Delete"
                  data-testid={`hv-menu-delete-${item.item_id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Ingredient list */}
            <div className="space-y-1 mb-3">
              {(item.custom_ingredients ?? []).map((ing) => (
                <div key={ing.name} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-black/30">
                  <span className={ing.available ? "text-amber-100" : "text-amber-100/40 line-through"}>
                    + {ing.name} · ${ing.price.toFixed(2)}
                  </span>
                  <button
                    onClick={() => toggleIng(item, ing.name)}
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      ing.available ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                    }`}
                    data-testid={`hv-ing-toggle-${item.item_id}-${ing.name}`}
                  >
                    {ing.available ? "ON" : "OFF"}
                  </button>
                </div>
              ))}
            </div>
            {/* Add ingredient */}
            <div className="flex gap-2">
              <input
                type="text"
                value={ingDraft[item.item_id]?.name ?? ""}
                onChange={(e) => setIngDraft({ ...ingDraft, [item.item_id]: { ...(ingDraft[item.item_id] ?? { name: "", cost: "" }), name: e.target.value } })}
                placeholder="Extra ingredient (e.g. Bacon)"
                data-testid={`hv-ing-name-${item.item_id}`}
                className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-amber-400/20 text-xs text-white placeholder:text-white/30"
              />
              <input
                type="number"
                step="0.01"
                value={ingDraft[item.item_id]?.cost ?? ""}
                onChange={(e) => setIngDraft({ ...ingDraft, [item.item_id]: { ...(ingDraft[item.item_id] ?? { name: "", cost: "" }), cost: e.target.value } })}
                placeholder="Cost"
                data-testid={`hv-ing-cost-${item.item_id}`}
                className="w-24 px-3 py-1.5 rounded-lg bg-black/40 border border-amber-400/20 text-xs text-white placeholder:text-white/30"
              />
              <button
                onClick={() => addIng(item)}
                disabled={busy}
                data-testid={`hv-ing-add-${item.item_id}`}
                className="px-3 py-1.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 text-xs font-black uppercase tracking-wider"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── PROMOS TAB ───────────────────────────────────────────────────────

function PromosTab({
  promos,
  busy,
  setBusy,
  reload,
}: {
  promos: Promo[];
  busy: boolean;
  setBusy: (b: boolean) => void;
  reload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState({ code: "", value: "", isPercent: true, limit: "100" });

  const create = async () => {
    if (!draft.code.trim() || !draft.value || !draft.limit) {
      return toast.error("Fill all fields");
    }
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/hungryvibes/merchant/promos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: draft.code,
          discount_value: parseFloat(draft.value),
          is_percent: draft.isPercent,
          limit: parseInt(draft.limit, 10),
        }),
      });
      if (!res.ok) {
        toast.error((await res.json()).detail ?? "Failed");
        return;
      }
      toast.success(`Code "${draft.code.toUpperCase()}" live`);
      setDraft({ code: "", value: "", isPercent: true, limit: "100" });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const flashToggle = async (promo: Promo) => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/hungryvibes/merchant/promos/${promo.promo_id}/toggle`, {
        method: "PATCH",
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.promo.active ? `${promo.code} ON` : `${promo.code} paused`);
        await reload();
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (promo: Promo) => {
    if (!window.confirm(`Retire ${promo.code}?`)) return;
    setBusy(true);
    try {
      await authFetch(`${API}/api/hungryvibes/merchant/promos/${promo.promo_id}`, { method: "DELETE" });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="hv-promos-tab">
      {/* Create card */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-amber-400/20" data-testid="hv-promo-create-card">
        <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold mb-2.5" style={{ fontFamily: "'Cinzel', serif" }}>
          Create a code · Drive traffic in slow hours
        </p>
        <div className="grid md:grid-cols-12 gap-2">
          <input
            type="text"
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
            placeholder="VIBE50"
            maxLength={24}
            data-testid="hv-promo-new-code"
            className="md:col-span-3 px-3 py-2 rounded-lg bg-black/40 border border-amber-400/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400 uppercase tracking-widest font-bold"
          />
          <input
            type="number"
            step="0.01"
            value={draft.value}
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
            placeholder={draft.isPercent ? "% off" : "$ off"}
            data-testid="hv-promo-new-value"
            className="md:col-span-2 px-3 py-2 rounded-lg bg-black/40 border border-amber-400/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400"
          />
          <div className="md:col-span-3 flex rounded-lg overflow-hidden border border-amber-400/20" role="tablist">
            <button
              onClick={() => setDraft({ ...draft, isPercent: true })}
              data-testid="hv-promo-new-pct"
              className={`flex-1 text-xs font-black uppercase tracking-wider ${draft.isPercent ? "bg-amber-500 text-[#1a0d05]" : "bg-black/40 text-amber-200"}`}
            >
              Percent
            </button>
            <button
              onClick={() => setDraft({ ...draft, isPercent: false })}
              data-testid="hv-promo-new-fixed"
              className={`flex-1 text-xs font-black uppercase tracking-wider ${!draft.isPercent ? "bg-amber-500 text-[#1a0d05]" : "bg-black/40 text-amber-200"}`}
            >
              Fixed $
            </button>
          </div>
          <input
            type="number"
            value={draft.limit}
            onChange={(e) => setDraft({ ...draft, limit: e.target.value })}
            placeholder="Vibe Limit"
            data-testid="hv-promo-new-limit"
            className="md:col-span-2 px-3 py-2 rounded-lg bg-black/40 border border-amber-400/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400"
          />
          <button
            onClick={create}
            disabled={busy}
            data-testid="hv-promo-new-submit"
            className="md:col-span-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-[#1a0d05] font-black text-xs uppercase tracking-widest disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> Launch
          </button>
        </div>
      </div>

      {/* Code list */}
      {promos.length === 0 ? (
        <div className="text-center text-amber-100/50 py-8 text-sm" data-testid="hv-promo-empty">
          No promo codes yet — your first VIBE PROMO is one click away.
        </div>
      ) : (
        promos.map((p) => (
          <motion.div
            key={p.promo_id}
            layout
            className="p-4 rounded-2xl bg-white/[0.03] border border-amber-400/15 flex flex-wrap items-center gap-4 justify-between"
            data-testid={`hv-promo-${p.promo_id}`}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <code className="text-lg font-black tracking-widest text-amber-300" style={{ fontFamily: "'Cinzel', serif" }}>{p.code}</code>
                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-black tracking-wider ${p.active ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                  {p.active ? "Live" : "Paused"}
                </span>
                {p.uses_remaining <= 0 ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-black tracking-wider bg-slate-500/20 text-slate-300">Exhausted</span>
                ) : null}
              </div>
              <p className="text-xs text-amber-100/70">
                {p.is_percent ? `${p.discount_value}% off` : `$${p.discount_value.toFixed(2)} off`} · Live tracker:{" "}
                <strong className="text-amber-200">{p.uses_today}</strong> redemptions today · {p.uses_remaining}/{p.limit} remaining
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => flashToggle(p)}
                disabled={busy || p.uses_remaining <= 0}
                data-testid={`hv-promo-toggle-${p.promo_id}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${
                  p.active
                    ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                } disabled:opacity-40`}
              >
                <Power className="w-3.5 h-3.5" /> {p.active ? "Flash off" : "Flash on"}
              </button>
              <button
                onClick={() => remove(p)}
                data-testid={`hv-promo-delete-${p.promo_id}`}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/30 text-rose-300 inline-flex items-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}

// ─── VIBE ACCOUNT TAB ─────────────────────────────────────────────────

function VibeAccountTab({
  account,
  busy,
  setBusy,
  onSettle,
}: {
  account: VibeAccount | null;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onSettle: () => Promise<void>;
}) {
  const [testAmount, setTestAmount] = useState("40");

  const settleTest = async () => {
    const amt = parseFloat(testAmount);
    if (!amt || amt <= 0) return toast.error("Amount > 0");
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/hungryvibes/merchant/vibe-account/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_total: amt, order_id: `test_${Date.now()}` }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`+$${data.credited.toFixed(2)} credited (vibe tax $${data.vibe_tax.toFixed(2)})`);
        await onSettle();
      } else {
        toast.error(data.detail ?? "Failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const taxPct = useMemo(() => ((account?.vibe_tax_rate ?? 0.02) * 100).toFixed(0), [account]);

  if (!account) {
    return (
      <div className="text-center py-8 text-amber-100/50 text-sm" data-testid="hv-vibe-loading">
        Loading account…
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="hv-vibe-tab">
      {/* Balance hero */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-rose-500/15 border border-amber-400/30 shadow-[0_0_30px_rgba(245,158,11,0.25)]">
        <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
          Vibe Account · Instant Credit
        </p>
        <div className="flex items-end gap-3">
          <Coins className="w-12 h-12 text-amber-300" />
          <div>
            <p className="text-5xl font-black text-amber-200 tabular-nums" style={{ fontFamily: "'Cinzel', serif" }} data-testid="hv-vibe-balance">
              ${account.balance.toFixed(2)}
            </p>
            <p className="text-xs text-amber-100/70 mt-1">Vibe Tax {taxPct}% deducted on every settlement</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            value={testAmount}
            onChange={(e) => setTestAmount(e.target.value)}
            data-testid="hv-vibe-test-amount"
            className="w-32 px-3 py-2 rounded-lg bg-black/40 border border-amber-400/20 text-sm text-white"
          />
          <button
            onClick={settleTest}
            disabled={busy}
            data-testid="hv-vibe-test-settle"
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#1a0d05] font-black text-xs uppercase tracking-widest disabled:opacity-50"
          >
            Test Settlement
          </button>
        </div>
      </div>

      {/* Ledger */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-amber-400/15">
        <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold mb-3" style={{ fontFamily: "'Cinzel', serif" }}>
          Recent Settlements
        </p>
        {account.ledger.length === 0 ? (
          <p className="text-amber-100/50 text-sm text-center py-4" data-testid="hv-vibe-ledger-empty">
            No settlements yet. When a customer pays for an order it lands here automatically.
          </p>
        ) : (
          <div className="space-y-1.5" data-testid="hv-vibe-ledger">
            {account.ledger.map((entry) => (
              <div key={entry.ledger_id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-black/30 text-xs">
                <div>
                  <p className="font-mono text-amber-100">Order {entry.order_id.slice(0, 12)}…</p>
                  <p className="text-amber-100/50 text-[10px]">{new Date(entry.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-300 font-black tabular-nums">+${entry.net_credit.toFixed(2)}</p>
                  <p className="text-rose-300/70 text-[10px] tabular-nums">tax ${entry.vibe_tax.toFixed(2)} of ${entry.gross.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



// ─── ORDERS TAB ───────────────────────────────────────────────────────
//
// 2026-05-12 founder ask: "If I had drivers and merchants right now, would
// everything work?" Built the merchant fulfillment loop end-to-end so the
// answer is now YES.
//
// Polls /api/hungryvibes/orders/merchant-inbox every 8s. Active orders
// show at the top; each card has the correct CTA for its current state
// (Accept/Reject when pending → Mark Ready when preparing → Mark Delivered
// when ready). Delivered/Rejected hidden by default; toggle "Show archive"
// to include them. Marking delivered auto-credits the merchant's Vibe
// Account net of the 2% Vibe Tax (server-side).

interface HVOrder {
  order_id: string;
  customer_user_id: string;
  merchant_id: string;
  food_payout_usd: number;
  status: "pending" | "paid" | "preparing" | "ready" | "delivered" | "rejected";
  payment_method: "card" | "coins";
  coins_paid?: number | null;
  pickup_at?: { lat: number; lng: number };
  deliver_to?: { lat: number; lng: number };
  note?: string | null;
  created_at: string;
  status_history?: Record<string, string>;
}

const STATUS_TINT: Record<HVOrder["status"], string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-400/40",
  paid: "bg-amber-500/15 text-amber-300 border-amber-400/40",
  preparing: "bg-cyan-500/15 text-cyan-300 border-cyan-400/40",
  ready: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/40",
  delivered: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-400/40",
};

function OrdersTab({ onSettlementCredit }: { onSettlementCredit: () => Promise<void> }) {
  const [orders, setOrders] = useState<HVOrder[]>([]);
  const [includeArchive, setIncludeArchive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(
        `${API}/api/hungryvibes/orders/merchant-inbox?include_archived=${includeArchive}`,
      );
      if (!res.ok) {
        setOrders([]);
        return;
      }
      const data = await res.json();
      setOrders(data.orders || []);
    } finally {
      setLoading(false);
    }
  }, [includeArchive]);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const transition = async (
    order: HVOrder,
    action: "accept" | "ready" | "delivered" | "reject",
  ) => {
    setBusyId(order.order_id);
    try {
      const res = await authFetch(
        `${API}/api/hungryvibes/orders/merchant/${order.order_id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || `Could not ${action} order`);
        return;
      }
      toast.success(
        action === "accept"
          ? "Order accepted · preparing"
          : action === "ready"
          ? "Order marked ready"
          : action === "delivered"
          ? "Delivered — vibe account credited"
          : "Order rejected — customer refunded",
      );
      await load();
      if (action === "delivered") await onSettlementCredit();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-amber-200/60 text-sm" data-testid="hv-orders-loading">
        Loading orders…
      </div>
    );
  }

  return (
    <div data-testid="hv-orders-tab">
      <div className="flex items-center justify-between mb-4">
        <p className="text-amber-100/80 text-sm">
          {orders.length === 0
            ? includeArchive
              ? "No orders yet."
              : "No active orders — flip 'Show archive' to see past orders."
            : `${orders.length} order${orders.length === 1 ? "" : "s"}${includeArchive ? "" : " · active queue"}`}
        </p>
        <button
          type="button"
          onClick={() => setIncludeArchive((v) => !v)}
          data-testid="hv-orders-toggle-archive"
          className="text-[10px] uppercase tracking-widest text-amber-300/80 hover:text-white border border-amber-400/30 px-3 py-1 rounded-full"
        >
          {includeArchive ? "Active only" : "Show archive"}
        </button>
      </div>

      <div className="space-y-3" data-testid="hv-orders-list">
        {orders.map((o) => {
          const tint = STATUS_TINT[o.status] || STATUS_TINT.pending;
          const isActionable = ["pending", "paid", "preparing", "ready"].includes(o.status);
          return (
            <div
              key={o.order_id}
              className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-4"
              data-testid={`hv-order-${o.order_id}`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] uppercase tracking-widest font-bold border px-2 py-0.5 rounded-full ${tint}`}
                      data-testid={`hv-order-status-${o.order_id}`}
                    >
                      {o.status}
                    </span>
                    <span className="text-amber-100 font-bold">
                      ${o.food_payout_usd.toFixed(2)}
                    </span>
                    {o.payment_method === "coins" && (
                      <span className="text-cyan-300/80 text-[10px]">paid in ₵</span>
                    )}
                  </div>
                  <p className="text-xs text-amber-100/60 truncate">
                    Order {o.order_id.slice(0, 8)} · {new Date(o.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {o.note && (
                    <p className="text-xs text-amber-200/80 mt-1 italic">"{o.note}"</p>
                  )}
                </div>
                <Clock className="w-4 h-4 text-amber-300/60 shrink-0" />
              </div>

              {isActionable && (
                <div className="flex flex-wrap gap-2">
                  {(o.status === "pending" || o.status === "paid") && (
                    <>
                      <button
                        onClick={() => transition(o, "accept")}
                        disabled={busyId === o.order_id}
                        data-testid={`hv-order-accept-${o.order_id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/80 hover:bg-emerald-400 text-[#0a1a0e] text-xs font-bold disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                      </button>
                      <button
                        onClick={() => transition(o, "reject")}
                        disabled={busyId === o.order_id}
                        data-testid={`hv-order-reject-${o.order_id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/30 hover:bg-rose-500/50 text-rose-100 text-xs font-bold disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject · refund
                      </button>
                    </>
                  )}
                  {o.status === "preparing" && (
                    <button
                      onClick={() => transition(o, "ready")}
                      disabled={busyId === o.order_id}
                      data-testid={`hv-order-ready-${o.order_id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-fuchsia-500/80 hover:bg-fuchsia-400 text-white text-xs font-bold disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark ready
                    </button>
                  )}
                  {o.status === "ready" && (
                    <button
                      onClick={() => transition(o, "delivered")}
                      disabled={busyId === o.order_id}
                      data-testid={`hv-order-delivered-${o.order_id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-[#1a0d05] text-xs font-bold disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark delivered
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
