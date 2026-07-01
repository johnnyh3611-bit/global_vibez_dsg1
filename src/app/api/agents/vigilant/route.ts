import { NextResponse } from 'next/server';
import { SovereignAgent } from '@/services/ai/sovereign/SovereignAgent';

export async function POST(req: Request) {
  const body = await req.json();
  const agent = new SovereignAgent();
  const response = await agent.process(body);
  
  return NextResponse.json({ 
    agent: 'Vigilant', 
    mastermindResponse: response 
  });
}
