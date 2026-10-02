import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

let rawApiUrl =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://cspace-whatsapp-bot.onrender.com';

if (rawApiUrl.includes('onrender') && !rawApiUrl.includes('onrender.com')) {
  rawApiUrl = rawApiUrl.replace('onrender', 'onrender.com');
}
if (!rawApiUrl.startsWith('http://') && !rawApiUrl.startsWith('https://')) {
  rawApiUrl = `https://${rawApiUrl}`;
}

export const BACKEND_URL = rawApiUrl.replace(/\/+$/, '');

/**
 * Reencaminha com segurança qualquer pedido do Next.js API Route para o backend Express (Render)
 */
export async function proxyToBackend(
  request: NextRequest,
  backendPath: string,
  options: {
    requireRole?: 'super_admin' | 'admin' | 'user';
    method?: string;
  } = {}
) {
  try {
    const session = await getSession();

    // Verificação de Role (se exigido)
    if (options.requireRole === 'super_admin' && (!session || session.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Acesso negado. Requer Super Admin.' }, { status: 403 });
    }

    if (options.requireRole === 'admin' && (!session || (session.role !== 'super_admin' && session.role !== 'admin'))) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    // Passar cookies e headers de autenticação
    const token = request.cookies.get('cspace_session')?.value;
    const cookieHeader = request.headers.get('cookie') || (token ? `cspace_session=${token}` : '');

    const method = options.method || request.method;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': request.headers.get('user-agent') || 'NextJS-Proxy',
    };

    if (cookieHeader) headers['cookie'] = cookieHeader;
    if (token) headers['authorization'] = `Bearer ${token}`;

    let body: any = undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        const text = await request.text();
        if (text) body = text;
      } catch (_) {}
    }

    const backendUrl = `${BACKEND_URL}${backendPath}${request.nextUrl.search}`;
    const backendRes = await fetch(backendUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
    });

    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: any) {
    console.error(`[API Proxy Error for ${backendPath}]:`, err?.message || err);
    return NextResponse.json(
      { error: `Não foi possível conectar ao servidor (${BACKEND_URL}): ${err?.message || 'Erro de conexão'}` },
      { status: 503 }
    );
  }
}
