import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Reencaminhar para o backend Express
    const backendRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': ip,
        'X-User-Agent': userAgent,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await backendRes.json();

    if (!backendRes.ok || !data.success) {
      // Log de tentativa falha (pode ser enviado para sistema de auditoria)
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
        userId: data.user.userId,
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
      userAgent: userAgent.substring(0, 200), // Limitar tamanho
    };

    response.cookies.set('cspace_session_meta', JSON.stringify(metadata), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    // Log de sucesso
    console.info(`[Auth] Successful login for ${email} from ${ip}`);

    return response;
  } catch (err) {
    console.error('[Login API]', err);
    return NextResponse.json(
      { error: 'Não foi possível conectar ao servidor de autenticação.' },
      { status: 503 }
    );
  }
}
