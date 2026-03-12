'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export function LandingSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('q', query.trim());
    }
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find me a wedding photographer in NYC under $200"
        className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm focus:border-slate-500 focus:outline-none"
      />
      <button type="submit" className="rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
        Search Creators
      </button>
    </form>
  );
}
