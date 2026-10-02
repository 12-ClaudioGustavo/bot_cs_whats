import { NextResponse } from 'next/server';

const rawApiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://cspace-whatsapp-bot.onrender.com';
const API_URL = rawApiUrl.replace(/\/+$/, '');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, rememberMe } = body;

    // Validação básica
    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-mail e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    // Obter IP e User-Agent para auditoria
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Mozilla/5.0';

    // Reencaminhar para o backend Express
    const backendRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'X-Forwarded-For': ip,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await backendRes.json();

    if (!backendRes.ok || !data.success) {
      console.warn(`[Auth] Failed login attempt for ${email} from ${ip}`);

      return NextResponse.json(
        { error: data.error || 'Credenciais inválidas.' },
        { status: backendRes.status || 401 }
      );
    }

    // Calcular maxAge baseado no rememberMe
    const maxAge = rememberMe
      ? 30 * 24 * 60 * 60 // 30 dias
      : 7 * 24 * 60 * 60;  // 7 dias

    // Criar resposta com sucesso
    const response = NextResponse.json({
      success: true,
      user: {
        userId: data.user.id || data.user.userId,
        email: data.user.email,
        role: data.user.role,
        fullName: data.user.fullName,
        tenantName: data.user.tenantName,
      },
    });

    // Definir cookie HttpOnly principal
    response.cookies.set('cspace_session', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    // Definir cookie de metadata (também HttpOnly)
    const metadata = {
      loginAt: new Date().toISOString(),
      rememberMe: !!rememberMe,
      userAgent: userAgent.substring(0, 200),
    };

    response.cookies.set('cspace_session_meta', JSON.stringify(metadata), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    console.info(`[Auth] Successful login for ${email} from ${ip}`);

    return response;
  } catch (err: any) {
    console.error('[Login API Error]', err);
    return NextResponse.json(
      { error: `Erro de conexão com o servidor de autenticação (${API_URL}): ${err?.message || 'Servidor indisponível'}` },
      { status: 503 }
    );
  }
}
