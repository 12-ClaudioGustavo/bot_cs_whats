import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function getAuthHeaders(request: NextRequest) {
  const cookie = request.headers.get('cookie');
  const session = await getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (cookie) headers['cookie'] = cookie;

  return { headers, session };
}

export async function GET(request: NextRequest) {
  try {
    const { headers, session } = await getAuthHeaders(request);
    if (!session || (session.role !== 'super_admin' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const res = await fetch(`${API_URL}/api/admin/users`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno de proxy.' }, { status: 500 });
  }
}
