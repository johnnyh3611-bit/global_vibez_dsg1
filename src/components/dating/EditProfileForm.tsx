"use client";

import { FormEvent, useEffect, useState } from "react";

export interface ProfileFormValues {
  name: string;
  age: string;
  bio: string;
  interests: string;
  location: string;
}

interface EditProfileFormProps {
  initial?: ProfileFormValues | null;
  onSave?: (values: ProfileFormValues) => void;
  onCancel?: () => void;
}

const EMPTY: ProfileFormValues = {
  name: "",
  age: "",
  bio: "",
  interests: "",
  location: "",
};

export function EditProfileForm({ initial, onSave, onCancel }: EditProfileFormProps) {
  const [values, setValues] = useState<ProfileFormValues>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (initial) setValues(initial);
  }, [initial]);

  function set(key: keyof ProfileFormValues, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/dating/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          age: parseInt(values.age, 10),
          bio: values.bio,
          interests: values.interests
            .split(",")
            .map((i) => i.trim())
            .filter(Boolean),
          location: values.location,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save profile");
      }

      setSuccess(true);
      onSave?.(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
        Edit your profile
      </h2>

      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Name
        </label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Your name"
          required
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-700"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Age
        </label>
        <input
          type="number"
          value={values.age}
          onChange={(e) => set("age", e.target.value)}
          placeholder="18"
          min={18}
          max={120}
          required
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-700"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Bio
        </label>
        <textarea
          value={values.bio}
          onChange={(e) => set("bio", e.target.value)}
          placeholder="Tell others about yourself…"
          rows={3}
          required
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-700"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Interests{" "}
          <span className="font-normal text-zinc-500">(comma-separated)</span>
        </label>
        <input
          type="text"
          value={values.interests}
          onChange={(e) => set("interests", e.target.value)}
          placeholder="Solana, hiking, coffee"
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-700"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Location
        </label>
        <input
          type="text"
          value={values.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="San Francisco"
          required
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-700"
        />
      </div>

      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm text-green-600 dark:text-green-400" role="status">
          Profile saved!
        </p>
      )}

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-zinc-300 py-2 text-sm font-semibold transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full bg-violet-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
