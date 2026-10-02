import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/apiProxy';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToBackend(request, `/api/admin/tenants/${id}/subscription`, { requireRole: 'super_admin', method: 'PATCH' });
}
