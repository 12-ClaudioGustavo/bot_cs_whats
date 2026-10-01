import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const cookie = request.headers.get('cookie');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cookie) headers['cookie'] = cookie;

    const res = await fetch(`${API_URL}/api/admin/users/${id}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro no proxy.' }, { status: 500 });
  }
}
