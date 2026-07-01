import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'active', 
    agents: ['sovereign', 'vigilant'],
    lastCheck: new Date().toISOString() 
  });
}
