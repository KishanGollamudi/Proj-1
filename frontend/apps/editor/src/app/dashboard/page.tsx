'use client';

import Link from 'next/link';

export default function EditorDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Editor Dashboard</h1>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Marketplace queue</p>
          <p className="mt-2 text-2xl font-bold">Open tasks</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Active edits</p>
          <p className="mt-2 text-2xl font-bold">Track progress</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Payout pipeline</p>
          <p className="mt-2 text-2xl font-bold">Awaiting approvals</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/editor-tasks" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Browse tasks</Link>
          <Link href="/earnings" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">View earnings</Link>
          <Link href="/portfolio" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Update profile</Link>
        </div>
      </section>
    </div>
  );
}
