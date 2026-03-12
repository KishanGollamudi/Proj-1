'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiGet } from '@/lib/api';

interface Report {
  summary: {
    bookings: number;
    disputes: number;
    users: number;
    revenue: number;
  };
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const now = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
  const [to, setTo] = useState(now.toISOString());

  const { data } = useQuery({
    queryKey: ['admin-analytics', from, to],
    queryFn: () => apiGet<Report>('/admin/analytics', session?.user?.accessToken, { from, to }),
    enabled: Boolean(session?.user?.accessToken)
  });

  const chartData = [
    { name: 'Bookings', value: data?.summary.bookings ?? 0 },
    { name: 'Users', value: data?.summary.users ?? 0 },
    { name: 'Disputes', value: data?.summary.disputes ?? 0 },
    { name: 'Revenue', value: data?.summary.revenue ?? 0 }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border px-3 py-2 text-sm" />
        <input value={to} onChange={(e) => setTo(e.target.value)} className="rounded border px-3 py-2 text-sm" />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#0f172a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
