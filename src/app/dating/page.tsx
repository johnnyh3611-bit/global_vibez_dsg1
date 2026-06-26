"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ProfileCard } from "@/components/dating/ProfileCard";
import { EditProfileForm, ProfileFormValues } from "@/components/dating/EditProfileForm";
import { useAuth } from "@/contexts/AuthContext";
import { DatingProfile } from "@/lib/dating/profiles";

export default function DatingPage() {
  const { publicKey, signOut } = useAuth();
  const [profiles, setProfiles] = useState<DatingProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [matchMessage, setMatchMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [myProfile, setMyProfile] = useState<ProfileFormValues | null>(null);

  useEffect(() => {
    fetch("/api/dating/profiles")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load profiles");
        return res.json();
      })
      .then((data) => setProfiles(data.profiles))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/dating/profile")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.profile) {
          const p = data.profile;
          setMyProfile({
            name: p.name ?? "",
            age: String(p.age ?? ""),
            bio: p.bio ?? "",
            interests: Array.isArray(p.interests) ? p.interests.join(", ") : "",
            location: p.location ?? "",
          });
        }
      })
      .catch(() => {});
  }, []);

  const advance = useCallback(() => {
    setCurrentIndex((i) => i + 1);
    setMatchMessage(null);
  }, []);

  const handleLike = useCallback(async () => {
    const profile = profiles[currentIndex];
    if (!profile) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/dating/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id }),
      });
      const data = await res.json();
      if (data.match) {
        setMatchMessage(`You matched with ${profile.name}!`);
        setTimeout(advance, 2000);
      } else {
        advance();
      }
    } catch {
      setError("Failed to send like");
    } finally {
      setActionLoading(false);
    }
  }, [profiles, currentIndex, advance]);

  const currentProfile = profiles[currentIndex];

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            Sol<span className="text-violet-600">Date</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dealer"
              className="flex items-center gap-2 transition-colors hover:text-purple-400"
            >
              <span className="text-xl">♠️</span>
              <span>Dealer Room</span>
            </Link>
            {publicKey && (
              <span className="hidden font-mono text-xs text-zinc-500 sm:inline">
                {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
              </span>
            )}
            <button
              onClick={() => setShowEditProfile((v) => !v)}
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              {showEditProfile ? "Browse" : "Edit profile"}
            </button>
            <button
              onClick={signOut}
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {showEditProfile ? (
          <EditProfileForm
            initial={myProfile}
            onSave={(values) => {
              setMyProfile(values);
              setShowEditProfile(false);
            }}
            onCancel={() => setShowEditProfile(false)}
          />
        ) : (
          <>
            {loading && (
              <p className="text-zinc-500">Loading profiles...</p>
            )}

            {error && (
              <p className="text-red-500" role="alert">
                {error}
              </p>
            )}

            {!loading && !error && !currentProfile && (
              <div className="text-center">
                <p className="text-xl font-semibold">No more profiles</p>
                <p className="mt-2 text-zinc-500">
                  Check back later for new matches.
                </p>
              </div>
            )}

            {matchMessage && (
              <div className="mb-6 rounded-full bg-green-100 px-6 py-2 text-sm font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                {matchMessage}
              </div>
            )}

            {currentProfile && (
              <ProfileCard
                profile={currentProfile}
                onLike={handleLike}
                onPass={advance}
                loading={actionLoading}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
