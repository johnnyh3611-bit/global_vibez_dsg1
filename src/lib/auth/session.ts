import { NextResponse } from 'next/server';

export const verifySession = async (token: string) => {
  if (!token) return { valid: false };
  return { valid: true };
};

export const createSession = async (data: any) => {
  return { success: true };
};

export const getSessionFromCookies = async () => {
  return { user: { id: 'demo-user' } };
};

export const sessionCookieOptions = {
  name: 'session',
  maxAge: 60 * 60 * 24 * 7,
};
