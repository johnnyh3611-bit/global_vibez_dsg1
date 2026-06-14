import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/auth-service";
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
    const { dealerName, userMessage }: { dealerName: DealerName; userMessage: string } = await request.json();
    const persona = dealerPersonas[dealerName] || "You are a friendly dealer.";

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
