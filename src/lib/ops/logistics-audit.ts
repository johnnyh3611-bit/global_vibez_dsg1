export type LogisticsService = "hunger-vibez" | "viberidez";

export interface LogisticsAuditEvent {
  id: string;
  service: LogisticsService;
  requestSource: "frontend";
  status: "queued" | "persisted";
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  azureTraceId: string;
  note: string;
}

const MAX_EVENTS = 200;
const events: LogisticsAuditEvent[] = [];

export function appendLogisticsEvent(event: LogisticsAuditEvent): void {
  events.unshift(event);
  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS;
  }
}

export function getLogisticsEvents(limit = 50): LogisticsAuditEvent[] {
  return events.slice(0, Math.max(1, Math.min(limit, MAX_EVENTS)));
}
