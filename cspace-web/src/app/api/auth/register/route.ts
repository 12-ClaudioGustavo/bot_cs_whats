import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName, fullName, email, phone, password } = body;

    // Validação básica
    if (!companyName || !fullName || !email || !password) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios.' },
        { status: 400 }
      );
    }

    // Validar formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato de e-mail inválido.' },
        { status: 400 }
      );
    }

    // Validar senha (mínimo 8 caracteres)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 8 caracteres.' },
        { status: 400 }
      );
    }

    // Obter IP e User-Agent para auditoria
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Reencaminhar para o backend Express
    const backendRes = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': ip,
      },
      body: JSON.stringify({ companyName, fullName, email, phone, password }),
    });

    const data = await backendRes.json();

    if (!backendRes.ok || !data.success) {
      return NextResponse.json(
        { error: data.error || 'Falha ao registar empresa.' },
        { status: backendRes.status || 400 }
      );
    }

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

    // Definir cookie de sessão automática após registro
    response.cookies.set('cspace_session', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 dias
    });

    // Definir metadata
    const metadata = {
      loginAt: new Date().toISOString(),
      registeredAt: new Date().toISOString(),
    };

    response.cookies.set('cspace_session_meta', JSON.stringify(metadata), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    // Log de sucesso
    console.info(`[Auth] New company registered: ${companyName} (${email}) from ${ip}`);

    return response;
  } catch (err) {
    console.error('[Register API]', err);
    return NextResponse.json(
      { error: 'Erro ao conectar ao servidor.' },
      { status: 503 }
    );
  }
}
