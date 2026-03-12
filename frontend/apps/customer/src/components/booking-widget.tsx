'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { toCurrency } from '@snapmatch/shared';

interface BookingWidgetProps {
  creatorId: string;
  hourlyRate: number;
}

export function BookingWidget({ creatorId, hourlyRate }: BookingWidgetProps) {
  const router = useRouter();
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [durationHours, setDurationHours] = useState(2);
  const [location, setLocation] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  const total = useMemo(() => hourlyRate * durationHours, [hourlyRate, durationHours]);

  function proceed(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const params = new URLSearchParams({
      creatorId,
      eventDate,
      startTime,
      durationHours: String(durationHours),
      location,
      specialInstructions
    });

    router.push(`/checkout/new?${params.toString()}`);
  }

  return (
    <form onSubmit={proceed} className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-lg font-semibold text-slate-900">Book this creator</h3>
      <div className="mt-3 space-y-3">
        <input required type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" />
        <input required type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" />
        <input
          required
          min={1}
          max={24}
          type="number"
          value={durationHours}
          onChange={(e) => setDurationHours(Number(e.target.value))}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Duration (hours)"
        />
        <input
          required
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Event location"
        />
        <textarea
          value={specialInstructions}
          onChange={(e) => setSpecialInstructions(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          rows={3}
          placeholder="Special instructions"
        />
      </div>
      <p className="mt-3 text-sm text-slate-700">Estimated total: <strong>{toCurrency(total)}</strong></p>
      <button type="submit" className="mt-4 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
        Proceed to Checkout
      </button>
    </form>
  );
}
