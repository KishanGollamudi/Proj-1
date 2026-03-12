'use client';

import { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { PaymentForm } from '@/components/payment-form';
import { toCurrency } from '@snapmatch/shared';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

export default function CheckoutPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;
  const searchParams = useSearchParams();
  const creatorId = searchParams.get('creatorId') ?? '';
  const eventDate = searchParams.get('eventDate') ?? '';
  const startTime = searchParams.get('startTime') ?? '10:00';
  const durationHours = Number(searchParams.get('durationHours') ?? 1);
  const location = searchParams.get('location') ?? '';
  const specialInstructions = searchParams.get('specialInstructions') ?? '';
  const estimatedRate = Number(searchParams.get('rate') ?? 100);

  const total = useMemo(() => durationHours * estimatedRate, [durationHours, estimatedRate]);

  if (bookingId !== 'new') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Booking Checkout</h1>
        <p className="mt-2 text-sm text-slate-600">
          Booking <strong>{bookingId}</strong> has been created. Track status from your dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Checkout</h1>
        <p className="mt-2 text-sm text-slate-600">Review details, enter card information, and confirm booking.</p>

        <div className="mt-5">
          <Elements stripe={stripePromise}>
            <PaymentForm
              creatorId={creatorId}
              eventDate={eventDate}
              startTime={startTime}
              durationHours={durationHours}
              location={location}
              specialInstructions={specialInstructions}
            />
          </Elements>
        </div>
      </section>

      <aside className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Booking Summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-slate-600">Date</dt><dd>{eventDate || '-'}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-600">Time</dt><dd>{startTime}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-600">Hours</dt><dd>{durationHours}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-600">Location</dt><dd className="text-right">{location || '-'}</dd></div>
          <div className="border-t pt-2 flex justify-between font-semibold"><dt>Total</dt><dd>{toCurrency(total)}</dd></div>
        </dl>
      </aside>
    </div>
  );
}
