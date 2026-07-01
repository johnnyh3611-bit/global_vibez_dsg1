import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateCompletion, parseSuggestions } from "@/lib/ollama/client";

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { profileData } = await request.json();

  if (!profileData?.bio || typeof profileData.bio !== "string") {
    return NextResponse.json(
      { error: "profileData.bio is required" },
      { status: 400 }
    );
  }

  try {
    const response = await generateCompletion(
      `You are the lead AI matchmaker for Global Vibez DSG. ` +
        `Write 3 creative, flirty, and high-energy opening lines for a user profile. ` +
        `The vibe should be "Club-ready" and "AAA Plus". ` +
        `Here is the bio: ${profileData.bio}`
    );

    const suggestions = parseSuggestions(response);

    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: "Could not generate suggestions" },
        { status: 502 }
      );
    }

    return NextResponse.json({ icebreakers: suggestions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach Ollama";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
