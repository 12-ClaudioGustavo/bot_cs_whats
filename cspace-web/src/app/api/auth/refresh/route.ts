import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    // Obter token atual do cookie
    const cookies = request.headers.get('cookie') || '';
    const sessionMatch = cookies.match(/cspace_session=([^;]+)/);

    if (!sessionMatch) {
      return NextResponse.json(
        { error: 'Nenhuma sessão ativa.' },
        { status: 401 }
      );
    }

    const currentToken = sessionMatch[1];
    const session = verifyToken(currentToken);

    if (!session) {
      return NextResponse.json(
        { error: 'Sessão inválida ou expirada.' },
        { status: 401 }
      );
    }

    // Verificar se o token está próximo de expirar (menos de 1 hora)
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = (session.exp || 0) - now;
    const oneHour = 60 * 60;

    if (timeUntilExpiry > oneHour) {
      // Token ainda tem bastante tempo, não precisa renovar
      return NextResponse.json({
        success: true,
        message: 'Sessão ainda válida',
        user: {
          userId: session.userId,
          email: session.email,
          role: session.role,
          fullName: session.fullName,
          tenantName: session.tenantName,
        },
      });
    }

    // Solicitar novo token do backend
    const backendRes = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
      },
    });

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: 'Não foi possível renovar a sessão.' },
        { status: 401 }
      );
    }

    const data = await backendRes.json();

    if (!data.success || !data.token) {
      return NextResponse.json(
        { error: 'Resposta inválida do servidor.' },
        { status: 500 }
      );
    }

    // Criar resposta com novo token
    const response = NextResponse.json({
      success: true,
      message: 'Sessão renovada com sucesso',
      user: {
        userId: data.user.userId,
        email: data.user.email,
        role: data.user.role,
        fullName: data.user.fullName,
        tenantName: data.user.tenantName,
      },
    });

    // Atualizar cookie com novo token
    const metaCookie = cookies.match(/cspace_session_meta=([^;]+)/);
    let rememberMe = false;

    if (metaCookie) {
      try {
        const metadata = JSON.parse(decodeURIComponent(metaCookie[1]));
        rememberMe = metadata.rememberMe || false;
      } catch {}
    }

    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;

    response.cookies.set('cspace_session', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    // Atualizar metadata
    const metadata = {
      loginAt: new Date().toISOString(),
      rememberMe,
      lastRefresh: new Date().toISOString(),
    };

    response.cookies.set('cspace_session_meta', JSON.stringify(metadata), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    console.info(`[Auth] Session refreshed for user ${session.userId}`);

    return response;
  } catch (err) {
    console.error('[Refresh API]', err);
    return NextResponse.json(
      { error: 'Erro ao renovar sessão.' },
      { status: 500 }
    );
  }
}
