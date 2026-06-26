import fs from "fs";
import path from "path";

import { DatingProfile } from "./profiles";

const PROFILES_FILE = path.join(process.cwd(), "data", "user-profiles.json");

export interface UserProfile extends DatingProfile {
  publicKey: string;
}

export interface UserProfileInput {
  name: string;
  age: number;
  bio: string;
  interests: string[];
  location: string;
}

function loadProfiles(): Record<string, UserProfile> {
  if (!fs.existsSync(PROFILES_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(PROFILES_FILE, "utf-8");
    return JSON.parse(raw) as Record<string, UserProfile>;
  } catch {
    return {};
  }
}

function saveProfiles(profiles: Record<string, UserProfile>): void {
  fs.mkdirSync(path.dirname(PROFILES_FILE), { recursive: true });
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), "utf-8");
}

export function getUserProfile(publicKey: string): UserProfile | null {
  const profiles = loadProfiles();
  return profiles[publicKey] ?? null;
}

export function upsertUserProfile(
  publicKey: string,
  input: UserProfileInput
): UserProfile {
  const profiles = loadProfiles();
  const existing = profiles[publicKey];
  const updated: UserProfile = {
    id: existing?.id ?? publicKey,
    publicKey,
    name: input.name,
    age: input.age,
    bio: input.bio,
    interests: input.interests,
    location: input.location,
  };
  profiles[publicKey] = updated;
  saveProfiles(profiles);
  return updated;
}

export function getAllUserProfiles(): UserProfile[] {
  const profiles = loadProfiles();
  return Object.values(profiles);
}
