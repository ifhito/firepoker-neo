'use client';

import { useQuery } from '@tanstack/react-query';
import type { PBIListResponse } from '@/domain/pbi';

const fetchPbis = async (params?: { status?: string; search?: string; sprint?: string }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.sprint) query.set('sprint', params.sprint);

  const response = await fetch(`/api/pbis${query.toString() ? `?${query.toString()}` : ''}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload?.message === 'string' ? payload.message : 'Failed to load PBIs';
    throw new Error(message);
  }
  return (await response.json()) as PBIListResponse;
};

export const usePbiQuery = (params?: { status?: string; search?: string; sprint?: string }) => {
  return useQuery({
    queryKey: ['pbis', params?.status ?? '', params?.search ?? '', params?.sprint ?? ''],
    queryFn: () => fetchPbis(params),
  });
};

export default usePbiQuery;
