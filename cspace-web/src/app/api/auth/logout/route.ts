import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Obter IP para log de auditoria
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Obter token do cookie para identificar usuário (antes de deletar)
    const cookies = request.headers.get('cookie') || '';
    const sessionMatch = cookies.match(/cspace_session=([^;]+)/);

    if (sessionMatch) {
      // Log de logout (pode ser enviado para sistema de auditoria)
      console.info(`[Auth] User logout from ${ip}`);
    }

    // Criar resposta
    const response = NextResponse.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

    // Deletar todos os cookies de sessão
    response.cookies.delete('cspace_session');
    response.cookies.delete('cspace_session_meta');
    response.cookies.delete('cspace_refresh_token');

    return response;
  } catch (err) {
    console.error('[Logout API]', err);
    return NextResponse.json(
      { error: 'Erro ao realizar logout.' },
      { status: 500 }
    );
  }
}
