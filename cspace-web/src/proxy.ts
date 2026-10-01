import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export default function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const token = request.cookies.get('cspace_session')?.value;
  const session = token ? verifyToken(token) : null;

  // Proteção da Área de Cliente (/dashboard)
  if (path.startsWith('/dashboard')) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Proteção da Área de Super Admin (/admin)
  if (path.startsWith('/admin')) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(loginUrl);
    }

    if (session.role !== 'super_admin') {
      // Utilizador normal tentou aceder ao /admin — redireciona para /dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Se já estiver logado e tentar ir para /login ou /register
  if ((path === '/login' || path === '/register') && session) {
    if (session.role === 'super_admin') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/login', '/register'],
};
