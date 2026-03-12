'use client';

import { FormEvent, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiPost } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

export default function SettingsPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const stripePortalUrl = process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL;

  async function onPasswordChange(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.email) {
      showToast('Please sign in again to continue', 'error');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      showToast('New password must be at least 8 characters', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await apiPost('/auth/forgot-password', { email: session.user.email });
      showToast('Password reset email sent. Follow the link to complete the update.');
      setOldPassword('');
      setNewPassword('');
    } catch (error) {
      console.error(error);
      showToast('Unable to start password reset right now', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Manage password and payment settings.</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Change password</h2>
        <form onSubmit={onPasswordChange} className="mt-4 space-y-3">
          <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Current password" />
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="New password" />
          <p className="text-xs text-slate-600">
            For security, password updates are completed by email verification.
          </p>
          <button disabled={submitting} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {submitting ? 'Sending reset link...' : 'Send reset link'}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Payment methods</h2>
        <p className="mt-2 text-sm text-slate-600">Manage cards and invoices in your Stripe customer portal.</p>
        <a
          href={stripePortalUrl || '#'}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
        >
          Open Stripe Customer Portal
        </a>
        {!stripePortalUrl ? (
          <p className="mt-2 text-xs text-amber-700">Set `NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL` to enable this link.</p>
        ) : null}
      </section>
    </div>
  );
}
