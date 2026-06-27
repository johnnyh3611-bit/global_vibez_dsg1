import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dealerPersonas, DealerName } from "@/lib/dealer/personas";
import { streamCompletion } from "@/lib/ollama/client";

const MAX_MESSAGE_LENGTH = 500;

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.hasChair) {
    return NextResponse.json(
      { error: "Chair holder access required" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { dealerName, userMessage } = body as Record<string, unknown>;

  if (typeof dealerName !== "string" || !(dealerName in dealerPersonas)) {
    return NextResponse.json({ error: "Invalid dealerName" }, { status: 400 });
  }

  if (typeof userMessage !== "string" || !userMessage.trim()) {
    return NextResponse.json({ error: "userMessage is required" }, { status: 400 });
  }

  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 }
    );
  }

  try {
    const persona = dealerPersonas[dealerName as DealerName];

    const stream = await streamCompletion(
      `${persona} User says: "${userMessage}"`
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch {
    return NextResponse.json({ error: "Dealer connection failed" }, { status: 502 });
  }
}
