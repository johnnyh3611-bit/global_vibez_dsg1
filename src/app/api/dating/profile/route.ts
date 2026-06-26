import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  getUserProfile,
  upsertUserProfile,
  UserProfileInput,
} from "@/lib/dating/user-profiles";
import { MIN_AGE, MAX_AGE } from "@/lib/dating/profiles";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = getUserProfile(session.publicKey);
  return NextResponse.json({ profile });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, age, bio, interests, location } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const ageNum = Number(age);
  if (!Number.isInteger(ageNum) || ageNum < MIN_AGE || ageNum > MAX_AGE) {
    return NextResponse.json(
      { error: `age must be an integer between ${MIN_AGE} and ${MAX_AGE}` },
      { status: 400 }
    );
  }

  if (typeof bio !== "string" || bio.trim() === "") {
    return NextResponse.json({ error: "bio is required" }, { status: 400 });
  }

  if (typeof location !== "string" || location.trim() === "") {
    return NextResponse.json({ error: "location is required" }, { status: 400 });
  }

  let interestsList: string[] = [];
  if (Array.isArray(interests)) {
    interestsList = interests
      .filter((i): i is string => typeof i === "string")
      .map((i) => i.trim())
      .filter(Boolean);
  } else if (typeof interests === "string") {
    interestsList = interests
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean);
  }

  const input: UserProfileInput = {
    name: name.trim(),
    age: ageNum,
    bio: bio.trim(),
    interests: interestsList,
    location: location.trim(),
  };

  const profile = upsertUserProfile(session.publicKey, input);
  return NextResponse.json({ profile });
}
