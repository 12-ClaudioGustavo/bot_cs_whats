import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function getAuthHeaders(request: NextRequest) {
  const cookie = request.headers.get('cookie') || '';
  return { 'Content-Type': 'application/json', Cookie: cookie };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  try {
    const res = await fetch(`${API_URL}/api/profile`, {
      headers: await getAuthHeaders(request),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Erro ao conectar ao servidor.' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  try {
    const body = await request.json();
    const res = await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: await getAuthHeaders(request),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Erro ao conectar ao servidor.' }, { status: 503 });
  }
}
