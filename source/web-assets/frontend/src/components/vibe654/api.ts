/**
 * Shared helpers for Vibe 654 frontend rooms — wallet / auth info extraction
 * + safe fetch wrappers. Keeps the page components lean.
 */

const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

export function getCurrentUser(): { userId: string; userName: string; token: string | null } {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId') || 'demo_b88a4250';
  const userEmail = localStorage.getItem('userEmail') || 'demo@globalvibez.com';
  const storedName = localStorage.getItem('userName');
  const userName = storedName || userEmail.split('@')[0] || 'Player';
  return { userId, userName, token };
}

function authHeaders(contentJson = false) {
  const { token } = getCurrentUser();
  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (contentJson) h['Content-Type'] = 'application/json';
  return h;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!r.ok) throw new Error(`GET ${path} ${r.status}`);
  return (await r.json()) as T;
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data && (data.detail || data.message)) || `POST ${path} ${r.status}`;
    throw new Error(msg);
  }
  return data as T;
}

/** Turn a raw event list + last-seen-ids set into fresh events (monotonic). */
export function pickNewEvents<T extends { event_id: string }>(
  events: T[] | undefined,
  seen: Set<string>,
): T[] {
  if (!events || events.length === 0) return [];
  const fresh: T[] = [];
  for (const ev of events) {
    if (!seen.has(ev.event_id)) {
      fresh.push(ev);
      seen.add(ev.event_id);
    }
  }
  return fresh;
}
