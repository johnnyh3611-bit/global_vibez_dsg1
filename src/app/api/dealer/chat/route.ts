import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dealerPersonas, DealerName } from "@/lib/dealer/personas";
import { streamCompletion } from "@/lib/ollama/client";

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

  try {
    const body = await request.json().catch(() => null);
    const { dealerName, userMessage } = body ?? {};

    if (!dealerName || typeof dealerName !== "string" || !(dealerName in dealerPersonas)) {
      return NextResponse.json({ error: "Invalid dealerName" }, { status: 400 });
    }

    if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) {
      return NextResponse.json({ error: "userMessage is required" }, { status: 400 });
    }

    if (userMessage.length > 2000) {
      return NextResponse.json({ error: "userMessage too long" }, { status: 400 });
    }

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
