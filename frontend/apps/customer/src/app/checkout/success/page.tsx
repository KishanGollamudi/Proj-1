'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function CheckoutSuccessPage() {
  const params = useSearchParams();
  const bookingId = params.get('bookingId');

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-emerald-200 bg-emerald-50 p-6">
      <h1 className="text-2xl font-semibold text-emerald-800">Booking confirmed</h1>
      <p className="mt-2 text-sm text-emerald-900">
        Your booking {bookingId ? <strong>{bookingId}</strong> : null} has been submitted successfully.
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-emerald-900">
        <li>You will receive confirmation emails shortly.</li>
        <li>Track updates in your dashboard.</li>
        <li>Contact support for any payment issues.</li>
      </ul>
      <Link href="/dashboard" className="mt-5 inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
        Go to Dashboard
      </Link>
    </div>
  );
}
