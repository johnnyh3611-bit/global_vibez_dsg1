import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  appendLogisticsEvent,
  type LogisticsAuditEvent,
  type LogisticsService,
} from "@/lib/ops/logistics-audit";

interface SimulatePayload {
  service?: LogisticsService;
}

function isService(value: string): value is LogisticsService {
  return value === "hunger-vibez" || value === "viberidez";
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as SimulatePayload;
  const service = body.service && isService(body.service) ? body.service : "hunger-vibez";

  const startedAtMs = Date.now();
  const artificialLatencyMs = 80 + Math.floor(Math.random() * 220);
  const completedAtMs = startedAtMs + artificialLatencyMs;

  const event: LogisticsAuditEvent = {
    id: crypto.randomUUID(),
    service,
    requestSource: "frontend",
    status: "persisted",
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    latencyMs: artificialLatencyMs,
    azureTraceId: `azdb-${crypto.randomUUID().slice(0, 8)}`,
    note: "Simulated request persisted for end-to-end audit verification.",
  };

  appendLogisticsEvent(event);
  console.info("[azure-db-log-simulated]", {
    eventId: event.id,
    traceId: event.azureTraceId,
    wallet: `${session.publicKey.slice(0, 4)}...${session.publicKey.slice(-4)}`,
    service: event.service,
    latencyMs: event.latencyMs,
  });

  return NextResponse.json({ event });
}
