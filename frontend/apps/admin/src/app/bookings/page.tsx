'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiGet } from '@/lib/api';

interface Booking {
  id: string;
  title: string;
  status: string;
  eventDate: string;
  customer?: { fullName: string };
  creator?: { fullName: string };
}

export default function AdminBookingsPage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState('');
  const { data } = useQuery({
    queryKey: ['admin-bookings', status],
    queryFn: () => apiGet<Booking[]>('/admin/bookings', session?.user?.accessToken, { status: status || undefined }),
    enabled: Boolean(session?.user?.accessToken)
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Bookings</h1>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-3 py-2 text-sm">
        <option value="">All statuses</option>
        <option value="REQUESTED">Requested</option>
        <option value="CONFIRMED">Confirmed</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELED">Canceled</option>
      </select>
      <div className="space-y-2">
        {(data ?? []).map((booking) => (
          <div key={booking.id} className="rounded border bg-white p-3 text-sm">
            <p className="font-medium">{booking.title}</p>
            <p className="text-slate-600">{booking.status} • {new Date(booking.eventDate).toLocaleString()}</p>
            <p className="text-slate-600">{booking.customer?.fullName} {'->'} {booking.creator?.fullName}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
