'use client';

import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

interface Plan {
  code: 'BASIC' | 'PRO' | 'UNLIMITED';
  name: string;
  monthlyPriceUsd: number;
  includedHours: number;
  fairUseLimitHours: number | null;
}

interface Subscription {
  id: string;
  plan: string;
  status: string;
  includedHours: string;
  usedHours: string;
  bonusHours: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string | null;
}

export default function SubscriptionPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<'BASIC' | 'PRO' | 'UNLIMITED'>('BASIC');
  const [paymentMethodId, setPaymentMethodId] = useState('pm_card_visa');
  const [topUpHours, setTopUpHours] = useState(1);

  const plansQuery = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => apiGet<Plan[]>('/subscriptions/plans')
  });

  const myQuery = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => apiGet<Subscription | null>('/subscriptions/my', session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken)
  });

  async function subscribe(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken) {
      return;
    }

    await apiPost('/subscriptions/subscribe', { plan: selectedPlan, paymentMethodId }, session.user.accessToken);
    showToast('Subscription activated');
    await myQuery.refetch();
  }

  async function cancel(): Promise<void> {
    if (!session?.user?.accessToken) {
      return;
    }

    await apiPut('/subscriptions/cancel', {}, session.user.accessToken);
    showToast('Subscription will cancel at period end');
    await myQuery.refetch();
  }

  async function topUp(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken) {
      return;
    }

    await apiPost('/subscriptions/top-up', { hours: topUpHours, paymentMethodId }, session.user.accessToken);
    showToast('Top-up successful');
    await myQuery.refetch();
  }

  const sub = myQuery.data;
  const availableHours = sub ? Number(sub.includedHours) + Number(sub.bonusHours) - Number(sub.usedHours) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Subscriptions</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Current Subscription</h2>
        {sub ? (
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p><strong>Plan:</strong> {sub.plan}</p>
            <p><strong>Status:</strong> {sub.status}</p>
            <p><strong>Usage:</strong> {Number(sub.usedHours).toFixed(2)} / {(Number(sub.includedHours) + Number(sub.bonusHours)).toFixed(2)} hours</p>
            <p><strong>Available:</strong> {availableHours.toFixed(2)} hours</p>
            <p><strong>Cancel at period end:</strong> {sub.cancelAtPeriodEnd ? 'Yes' : 'No'}</p>
            {sub.currentPeriodEnd ? <p><strong>Period end:</strong> {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p> : null}
            <button onClick={cancel} className="mt-2 rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white">Cancel at period end</button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No active subscription.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Plans</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(plansQuery.data ?? []).map((plan) => (
            <button
              key={plan.code}
              onClick={() => setSelectedPlan(plan.code)}
              className={`rounded border p-3 text-left text-sm ${selectedPlan === plan.code ? 'border-slate-900' : 'border-slate-200'}`}
            >
              <p className="font-semibold">{plan.name}</p>
              <p>${plan.monthlyPriceUsd}/mo</p>
              <p>{plan.includedHours} included hours</p>
              {plan.fairUseLimitHours ? <p>Fair use: {plan.fairUseLimitHours}h/mo</p> : null}
            </button>
          ))}
        </div>

        <form onSubmit={subscribe} className="mt-4 space-y-3">
          <input value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Payment method id" />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Subscribe to {selectedPlan}</button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Top Up Credits</h2>
        <form onSubmit={topUp} className="mt-3 flex gap-2">
          <input type="number" min={1} value={topUpHours} onChange={(e) => setTopUpHours(Number(e.target.value))} className="w-full rounded-md border px-3 py-2 text-sm" />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Top Up</button>
        </form>
      </section>
    </div>
  );
}
