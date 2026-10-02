import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/apiProxy';

export async function PUT(request: NextRequest) {
  return proxyToBackend(request, '/api/profile/password', { method: 'PUT' });
}
