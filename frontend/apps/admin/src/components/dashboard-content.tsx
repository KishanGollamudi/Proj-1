'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiGet } from '@/lib/api';

interface Kpis {
  totalUsers: number;
  activeBookings: number;
  pendingDisputes: number;
  revenue: number;
}

export function DashboardContent() {
  const { data: session } = useSession();
  const { data } = useQuery({
    queryKey: ['admin-kpis'],
    queryFn: () => apiGet<Kpis>('/admin/kpis', session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken)
  });

  const chartData = [
    { name: 'Users', value: data?.totalUsers ?? 0 },
    { name: 'Bookings', value: data?.activeBookings ?? 0 },
    { name: 'Disputes', value: data?.pendingDisputes ?? 0 },
    { name: 'Revenue', value: data?.revenue ?? 0 }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Total users</p><p className="mt-2 text-2xl font-bold">{data?.totalUsers ?? 0}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Active bookings</p><p className="mt-2 text-2xl font-bold">{data?.activeBookings ?? 0}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Pending disputes</p><p className="mt-2 text-2xl font-bold">{data?.pendingDisputes ?? 0}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Revenue</p><p className="mt-2 text-2xl font-bold">${(data?.revenue ?? 0).toFixed(2)}</p></div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Revenue Snapshot</h2>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#0f172a" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/users" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Users</Link>
          <Link href="/creators" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Creators</Link>
          <Link href="/editors" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Editors</Link>
          <Link href="/transactions" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Transactions</Link>
          <Link href="/analytics" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Analytics</Link>
          <Link href="/settings" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Settings</Link>
        </div>
      </section>
    </div>
  );
}
