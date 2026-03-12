'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { useToast } from '@snapmatch/shared';
import { useState } from 'react';

interface Booking {
  id: string;
  status: string;
  eventDate: string;
  title: string;
}

export default function CreatorDashboardPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const { data, refetch } = useQuery({
    queryKey: ['creator-bookings'],
    queryFn: () => apiGet<Booking[]>('/bookings?role=creator', session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken)
  });

  const upcoming = (data ?? []).slice(0, 5);

  async function onAccept(bookingId: string): Promise<void> {
    setActionBookingId(bookingId);
    try {
      await apiPost(`/bookings/${bookingId}/confirm`, {});
      showToast('Booking accepted');
      await refetch();
    } catch (error) {
      console.error(error);
      showToast('Failed to accept booking', 'error');
    } finally {
      setActionBookingId(null);
    }
  }

  async function onReject(bookingId: string): Promise<void> {
    if (!session?.user?.accessToken) {
      return;
    }

    setActionBookingId(bookingId);
    try {
      await apiPut(`/bookings/${bookingId}/cancel`, { reason: 'Creator unavailable' }, session.user.accessToken);
      showToast('Booking rejected');
      await refetch();
    } catch (error) {
      console.error(error);
      showToast('Failed to reject booking', 'error');
    } finally {
      setActionBookingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Creator Dashboard</h1>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Total Earnings</p>
          <p className="mt-2 text-2xl font-bold">$12,450</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Upcoming Jobs</p>
          <p className="mt-2 text-2xl font-bold">{upcoming.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Completion Rate</p>
          <p className="mt-2 text-2xl font-bold">96%</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Upcoming bookings</h2>
        <div className="mt-3 space-y-2">
          {upcoming.map((booking) => (
            <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">{booking.title}</p>
                <p className="text-slate-600">{new Date(booking.eventDate).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onReject(booking.id)}
                  disabled={actionBookingId === booking.id}
                  className="rounded-md border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-60"
                >
                  Reject
                </button>
                <button
                  onClick={() => onAccept(booking.id)}
                  disabled={actionBookingId === booking.id}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white disabled:opacity-60"
                >
                  Accept
                </button>
                <Link href={`/bookings/${booking.id}`} className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white">Open</Link>
              </div>
            </div>
          ))}
          {upcoming.length === 0 ? <p className="text-sm text-slate-600">No upcoming bookings yet.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/calendar" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Update Availability</Link>
          <Link href="/portfolio" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Upload Portfolio</Link>
        </div>
      </section>
    </div>
  );
}
