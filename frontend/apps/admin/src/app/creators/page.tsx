'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

interface CreatorItem {
  id: string;
  fullName: string;
  email: string;
  creatorProfile?: {
    applicationStatus: string;
    isFeatured: boolean;
  } | null;
}

export default function AdminCreatorsPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [applicationStatus, setApplicationStatus] = useState('PENDING');
  const { data, refetch } = useQuery({
    queryKey: ['admin-creators', applicationStatus],
    queryFn: () => apiGet<CreatorItem[]>('/admin/creators', session?.user?.accessToken, { applicationStatus }),
    enabled: Boolean(session?.user?.accessToken)
  });

  async function review(id: string, status: 'APPROVED' | 'REJECTED') {
    await apiPost(`/admin/creators/${id}/review`, { status }, session?.user?.accessToken);
    showToast(`Creator ${status.toLowerCase()}`);
    await refetch();
  }

  async function feature(id: string, featured: boolean) {
    await apiPost(`/admin/creators/${id}/featured`, { featured }, session?.user?.accessToken);
    showToast(featured ? 'Creator featured' : 'Creator unfeatured');
    await refetch();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Creators</h1>
      <select value={applicationStatus} onChange={(e) => setApplicationStatus(e.target.value)} className="rounded border px-3 py-2 text-sm">
        <option value="PENDING">Pending</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
      </select>
      <div className="space-y-2">
        {(data ?? []).map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded border bg-white p-3 text-sm">
            <div>
              <p className="font-medium">{item.fullName}</p>
              <p className="text-slate-600">{item.email} • {item.creatorProfile?.applicationStatus}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => review(item.id, 'APPROVED')} className="rounded border px-2 py-1">Approve</button>
              <button onClick={() => review(item.id, 'REJECTED')} className="rounded border px-2 py-1">Reject</button>
              <button onClick={() => feature(item.id, !item.creatorProfile?.isFeatured)} className="rounded border px-2 py-1">{item.creatorProfile?.isFeatured ? 'Unfeature' : 'Feature'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
