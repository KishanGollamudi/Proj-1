'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: string;
  verificationStatus: string;
  isActive: boolean;
}

export default function UsersPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [role, setRole] = useState('');

  const query = useQuery({
    queryKey: ['admin-users', role],
    queryFn: () => apiGet<UserRow[]>('/admin/users', session?.user?.accessToken, { role: role || undefined }),
    enabled: Boolean(session?.user?.accessToken)
  });

  async function verify(id: string) {
    await apiPost(`/admin/users/${id}/verify`, {}, session?.user?.accessToken);
    showToast('User verified');
    await query.refetch();
  }

  async function suspend(id: string) {
    await apiPost(`/admin/users/${id}/suspend`, {}, session?.user?.accessToken);
    showToast('User suspended');
    await query.refetch();
  }

  async function softDelete(id: string) {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.user?.accessToken}` }
    });
    showToast('User soft-deleted');
    await query.refetch();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All roles</option>
          <option value="CUSTOMER">Customer</option>
          <option value="CREATOR">Creator</option>
          <option value="EDITOR">Editor</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <div className="space-y-2">
        {(query.data ?? []).map((user) => (
          <div key={user.id} className="flex items-center justify-between rounded border bg-white p-3 text-sm">
            <div>
              <p className="font-medium">{user.fullName} ({user.role})</p>
              <p className="text-slate-600">{user.email} • {user.verificationStatus} • {user.isActive ? 'active' : 'suspended'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => verify(user.id)} className="rounded border px-2 py-1">Verify</button>
              <button onClick={() => suspend(user.id)} className="rounded border px-2 py-1">Suspend</button>
              <button onClick={() => softDelete(user.id)} className="rounded border px-2 py-1">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
