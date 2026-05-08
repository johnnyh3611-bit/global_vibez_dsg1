/**
 * Create a new Yellow Pages listing.
 * Adult/Entertainer category is gated: requires a license URL, age_verified
 * account, and goes into admin review before publishing.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Shield, Crown, ArrowLeft } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

interface Category {
  id: string;
  label: string;
  is_adult?: boolean;
  requires_license?: boolean;
}

export default function YellowPagesNewListing() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const refCode = params.get('ref') || '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    category: 'food',
    description: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    website: '',
    hours: '',
    license_doc_url: '',
  });

  useEffect(() => {
    fetch(`${API}/api/yellow-pages/categories`)
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  const isAdult = categories.find((c) => c.id === form.category)?.is_adult;

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isAdult && !form.license_doc_url) {
      setError('Adult/Entertainer listings require a license or permit URL.');
      return;
    }
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/yellow-pages/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          ambassador_ref: refCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create listing');
      // If adult, send to a "pending review" page; else go to detail.
      if (data.needs_review) {
        navigate(`/yellow-pages?submitted=review`);
      } else {
        navigate(`/yellow-pages/${data.listing.id}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white" data-testid="yp-new-listing-page">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Button variant="ghost" onClick={() => navigate('/yellow-pages')} className="mb-4 text-slate-300">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Yellow Pages
        </Button>

        <h1 className="text-4xl font-bold mb-2">List Your Business</h1>
        <p className="text-slate-400 mb-8">
          Free to list. Upgrade later for the green <span className="text-emerald-300 font-semibold">DSG Guard Verified</span> shield, gold <span className="text-amber-300 font-semibold">Elite</span> crown, or orange <span className="text-orange-300 font-semibold">Featured</span> top-of-zip pin.
        </p>

        {refCode && (
          <Alert className="mb-6 bg-yellow-500/10 border-yellow-500/40 text-yellow-200">
            <AlertDescription>
              Referred by ambassador <strong>{refCode}</strong> — they earn DSG credits when you upgrade.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="mb-6 bg-rose-500/15 border-rose-500/40 text-rose-200" data-testid="yp-form-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={submit} className="space-y-5">
          <Card className="bg-slate-900/60 border-slate-800 p-5 space-y-4">
            <div>
              <Label className="text-slate-300">Business name</Label>
              <Input
                required minLength={2} maxLength={140}
                value={form.name} onChange={(e) => set('name', e.target.value)}
                className="bg-slate-950/60 border-slate-700/70 mt-1"
                data-testid="yp-form-name"
              />
            </div>
            <div>
              <Label className="text-slate-300">Category</Label>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md bg-slate-950/60 border border-slate-700/70 text-white"
                data-testid="yp-form-category"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-slate-300">Description</Label>
              <Textarea
                value={form.description} onChange={(e) => set('description', e.target.value)}
                rows={3} maxLength={2000}
                className="bg-slate-950/60 border-slate-700/70 mt-1"
                data-testid="yp-form-description"
              />
            </div>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Location</h3>
            <Input required value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Street address" className="bg-slate-950/60 border-slate-700/70" data-testid="yp-form-address" />
            <div className="grid grid-cols-3 gap-3">
              <Input required value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" className="bg-slate-950/60 border-slate-700/70" data-testid="yp-form-city" />
              <Input value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="State" className="bg-slate-950/60 border-slate-700/70" data-testid="yp-form-state" />
              <Input required value={form.zip_code} onChange={(e) => set('zip_code', e.target.value)} placeholder="ZIP" inputMode="numeric" className="bg-slate-950/60 border-slate-700/70" data-testid="yp-form-zip" />
            </div>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Contact (optional)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Phone" className="bg-slate-950/60 border-slate-700/70" data-testid="yp-form-phone" />
              <Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="Email" type="email" className="bg-slate-950/60 border-slate-700/70" data-testid="yp-form-email" />
              <Input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="Website" className="bg-slate-950/60 border-slate-700/70 sm:col-span-2" data-testid="yp-form-website" />
              <Input value={form.hours} onChange={(e) => set('hours', e.target.value)} placeholder="Hours (e.g. Mon-Fri 9-5)" className="bg-slate-950/60 border-slate-700/70 sm:col-span-2" data-testid="yp-form-hours" />
            </div>
          </Card>

          {isAdult && (
            <Card className="bg-rose-500/5 border-rose-500/40 p-5 space-y-3" data-testid="yp-form-adult-block">
              <div className="flex items-center gap-2 text-rose-300">
                <Lock className="h-4 w-4" />
                <span className="font-semibold">18+ License Required</span>
              </div>
              <p className="text-sm text-slate-300">
                Adult/Entertainer listings must upload a current license, permit, or government-issued
                certification URL. Listings stay <strong>unpublished</strong> until DSG Guard reviews and approves your documentation.
              </p>
              <Input
                value={form.license_doc_url}
                onChange={(e) => set('license_doc_url', e.target.value)}
                placeholder="Paste a public URL to your license/permit"
                className="bg-slate-950/60 border-rose-500/40"
                data-testid="yp-form-license-url"
              />
            </Card>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-semibold py-6 text-lg"
            data-testid="yp-form-submit"
          >
            {submitting ? 'Submitting…' : isAdult ? 'Submit for DSG Guard review' : 'Publish my listing'}
          </Button>

          <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-4 pt-2">
            <span className="inline-flex items-center gap-1"><Shield className="h-3 w-3 text-emerald-400" /> Verified $29 one-time</span>
            <span className="inline-flex items-center gap-1"><Crown className="h-3 w-3 text-amber-400" /> Elite $99 one-time</span>
            <span className="inline-flex items-center gap-1">Featured $19/mo</span>
          </div>
        </form>
      </div>
    </div>
  );
}
