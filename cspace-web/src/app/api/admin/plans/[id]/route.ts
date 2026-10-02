import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/apiProxy';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToBackend(request, `/api/admin/plans/${id}`, { requireRole: 'super_admin' });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToBackend(request, `/api/admin/plans/${id}`, { requireRole: 'super_admin' });
}
