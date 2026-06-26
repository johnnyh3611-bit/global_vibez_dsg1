import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SAMPLE_PROFILES, DatingProfile } from "@/lib/dating/profiles";
import { getAllUserProfiles } from "@/lib/dating/user-profiles";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userProfiles = getAllUserProfiles().filter(
    (p) => p.publicKey !== session.publicKey
  );

  // User-created profiles take precedence; fill the rest with samples.
  const userProfileIds = new Set(userProfiles.map((p) => p.id));
  const samples = SAMPLE_PROFILES.filter((p) => !userProfileIds.has(p.id));
  const profiles: DatingProfile[] = [...userProfiles, ...samples];

  return NextResponse.json({ profiles });
}
