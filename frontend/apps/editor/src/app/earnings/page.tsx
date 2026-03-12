export default function EarningsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Earnings</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Transactions</h2>
        <div className="mt-3 space-y-2 text-sm">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="flex justify-between rounded border p-3">
              <span>Booking payout #{idx}</span>
              <span className="font-semibold">+$420.00</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Withdraw Funds</h2>
        <p className="mt-2 text-sm text-slate-600">Use Stripe Connect dashboard to manage payouts.</p>
        <a href="#" className="mt-3 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Open Stripe Dashboard</a>
      </section>
    </div>
  );
}
