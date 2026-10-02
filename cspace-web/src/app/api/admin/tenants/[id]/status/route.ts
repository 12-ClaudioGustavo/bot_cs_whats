import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/apiProxy';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToBackend(request, `/api/admin/tenants/${id}/status`, { requireRole: 'super_admin' });
}
