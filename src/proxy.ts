import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifySession } from "@/lib/auth";

const LATENCY_WARN_MS = 400;

function withGatewayTelemetry(
  request: NextRequest,
  response: NextResponse,
  startedAt: number,
  sessionPublicKey?: string
): NextResponse {
  const latencyMs = Date.now() - startedAt;
  response.headers.set("x-gateway-latency-ms", String(latencyMs));

  const payload = {
    type: "gateway-proxy",
    path: request.nextUrl.pathname,
    method: request.method,
    latencyMs,
    status: response.status,
    authenticated: Boolean(sessionPublicKey),
    wallet: sessionPublicKey ? `${sessionPublicKey.slice(0, 4)}...${sessionPublicKey.slice(-4)}` : null,
  };

  if (latencyMs >= LATENCY_WARN_MS) {
    console.warn("[gateway-latency-high]", payload);
  } else {
    console.info("[gateway-latency]", payload);
  }

  return response;
}

function redirectToLogin(request: NextRequest, startedAt: number): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(AUTH_COOKIE_NAME);
  return withGatewayTelemetry(request, response, startedAt);
}

export async function proxy(request: NextRequest) {
  const startedAt = Date.now();
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return redirectToLogin(request, startedAt);
  }

  const session = await verifySession(token);

  if (!session) {
    return redirectToLogin(request, startedAt);
  }

  return withGatewayTelemetry(request, NextResponse.next(), startedAt, session.publicKey);
}

export const config = {
  matcher: [
    "/dating/:path*",
    "/dealer/:path*",
    "/glasshouse/:path*",
    "/chair-registry/:path*",
    "/sweepstakes/:path*",
    "/operations/:path*",
  ],
};
