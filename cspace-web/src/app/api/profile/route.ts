import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/apiProxy';

export async function GET(request: NextRequest) {
  return proxyToBackend(request, '/api/profile');
}

export async function PUT(request: NextRequest) {
  return proxyToBackend(request, '/api/profile', { method: 'PUT' });
}
