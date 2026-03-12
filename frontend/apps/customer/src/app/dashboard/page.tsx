'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiGet } from '@/lib/api';
import { LoadingSpinner } from '@snapmatch/shared';

interface Booking {
  id: string;
  status: string;
  eventDate: string;
  title: string;
}

interface Subscription {
  plan: string;
  status: string;
  includedHours: string;
  usedHours: string;
  bonusHours: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => apiGet<Booking[]>('/bookings?role=customer', session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken)
  });
  const subscriptionQuery = useQuery({
    queryKey: ['subscription-usage'],
    queryFn: () => apiGet<Subscription | null>('/subscriptions/my', session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken)
  });

  const now = new Date();
  const upcoming = (data ?? []).filter((booking) => new Date(booking.eventDate) >= now);
  const past = (data ?? []).filter((booking) => new Date(booking.eventDate) < now);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">My Dashboard</h1>
      {isLoading ? <LoadingSpinner label="Loading bookings" /> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Subscription Usage</h2>
        {subscriptionQuery.data ? (
          <div className="mt-3 text-sm text-slate-700">
            <p><strong>Plan:</strong> {subscriptionQuery.data.plan} ({subscriptionQuery.data.status})</p>
            <p>
              <strong>Hours:</strong> {Number(subscriptionQuery.data.usedHours).toFixed(2)} used of{' '}
              {(Number(subscriptionQuery.data.includedHours) + Number(subscriptionQuery.data.bonusHours)).toFixed(2)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No active subscription. Subscribe to unlock credits.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Upcoming bookings</h2>
        <div className="mt-3 space-y-2">
          {upcoming.map((booking) => (
            <div key={booking.id} className="flex items-center justify-between rounded border p-3 text-sm">
              <div>
                <p className="font-medium">{booking.title}</p>
                <p className="text-slate-600">Status: {booking.status}</p>
              </div>
              <Link href={`/bookings/${booking.id}`} className="font-semibold underline">
                View details
              </Link>
            </div>
          ))}
          {upcoming.length === 0 ? <p className="text-sm text-slate-600">No upcoming bookings.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Past bookings</h2>
        <div className="mt-3 space-y-2">
          {past.map((booking) => (
            <div key={booking.id} className="flex items-center justify-between rounded border p-3 text-sm">
              <p>{booking.title}</p>
              <Link href={`/bookings/${booking.id}`} className="font-semibold underline">
                Gallery / Review
              </Link>
            </div>
          ))}
          {past.length === 0 ? <p className="text-sm text-slate-600">No past bookings yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
