'use client';

import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiPost } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

interface PaymentFormProps {
  creatorId: string;
  eventDate: string;
  startTime: string;
  durationHours: number;
  location: string;
  specialInstructions?: string;
}

export function PaymentForm(props: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!stripe || !elements || !session?.user?.accessToken) {
      return;
    }

    setSubmitting(true);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setSubmitting(false);
      return;
    }

    const tokenResult = await stripe.createPaymentMethod({ type: 'card', card: cardElement });

    if (tokenResult.error || !tokenResult.paymentMethod?.id) {
      showToast(tokenResult.error?.message || 'Unable to create payment method', 'error');
      setSubmitting(false);
      return;
    }

    try {
      const booking = await apiPost<{ id: string }>(
        '/bookings',
        {
          creatorId: props.creatorId,
          eventDate: `${props.eventDate}T00:00:00.000Z`,
          startTime: props.startTime,
          durationHours: props.durationHours,
          location: props.location,
          specialInstructions: props.specialInstructions,
          paymentMethodId: tokenResult.paymentMethod.id
        },
        session.user.accessToken,
        {
          idempotencyKey: `checkout-${props.creatorId}-${props.eventDate}-${props.startTime}-${props.durationHours}`
        }
      );

      showToast('Booking created successfully');
      router.push(`/checkout/success?bookingId=${booking.id}`);
    } catch (error) {
      console.error(error);
      showToast('Booking failed. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-md border border-slate-300 p-3">
        <CardElement />
      </div>
      <button
        type="submit"
        disabled={submitting || !stripe}
        className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? 'Processing...' : 'Confirm and Pay'}
      </button>
    </form>
  );
}
