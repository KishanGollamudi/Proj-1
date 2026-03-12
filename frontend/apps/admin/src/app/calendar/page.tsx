'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  available: boolean;
}

interface AvailabilityResponse {
  creatorId: string;
  isAvailable: boolean;
  slots: AvailabilitySlot[];
}

export default function CalendarPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [isAvailable, setIsAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const timeWindow = useMemo(() => {
    const start = new Date();
    const end = new Date(start);
    end.setHours(start.getHours() + 24);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
  }, []);

  const { data, refetch } = useQuery({
    queryKey: ['creator-availability', session?.user?.id, timeWindow.startDate, timeWindow.endDate],
    queryFn: () =>
      apiGet<AvailabilityResponse>(
        `/creators/${session?.user?.id}/availability`,
        undefined,
        { startDate: timeWindow.startDate, endDate: timeWindow.endDate }
      ),
    enabled: Boolean(session?.user?.id)
  });

  useEffect(() => {
    if (typeof data?.isAvailable === 'boolean') {
      setIsAvailable(data.isAvailable);
    }
  }, [data?.isAvailable]);

  async function saveAvailability(): Promise<void> {
    if (!session?.user?.accessToken) {
      return;
    }

    setSaving(true);
    try {
      await apiPut('/creators/availability', { isAvailable }, session.user.accessToken);
      await refetch();
      showToast('Availability updated');
    } catch (error) {
      console.error(error);
      showToast('Failed to update availability', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Calendar & Availability</h1>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">Next 24-hour slot availability based on current bookings.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(data?.slots ?? []).slice(0, 12).map((slot) => (
            <div key={slot.startAt} className={`rounded-md px-3 py-2 text-sm ${slot.available ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              <p className="font-medium">{slot.available ? 'Free' : 'Booked'}</p>
              <p className="text-xs">
                {new Date(slot.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
          {(data?.slots ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">No slots available yet. Save availability to refresh.</p>
          ) : null}
        </div>
        <label className="mt-5 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
          Accept new bookings
        </label>
        <button onClick={saveAvailability} disabled={saving} className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Saving...' : 'Save availability'}
        </button>
      </section>
    </div>
  );
}
