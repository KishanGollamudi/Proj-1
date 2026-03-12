'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiGet } from '@/lib/api';

interface Transaction {
  id: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  createdAt: string;
  payer?: { fullName?: string } | null;
  payee?: { fullName?: string } | null;
}

export default function TransactionsPage() {
  const { data: session } = useSession();
  const { data } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: () => apiGet<Transaction[]>('/admin/transactions', session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken)
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Transactions</h1>
      <div className="space-y-2">
        {(data ?? []).map((tx) => (
          <div key={tx.id} className="rounded border bg-white p-3 text-sm">
            <p className="font-medium">{tx.type} • {tx.status}</p>
            <p className="text-slate-600">{Number(tx.amount).toFixed(2)} {tx.currency}</p>
            <p className="text-slate-600">{tx.payer?.fullName || '-'} {'->'} {tx.payee?.fullName || '-'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
