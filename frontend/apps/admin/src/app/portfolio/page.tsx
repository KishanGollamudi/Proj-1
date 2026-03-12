'use client';

import { FormEvent, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiPost } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

export default function PortfolioPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [portfolioUrl, setPortfolioUrl] = useState('https://portfolio.example.com');
  const [hourlyRate, setHourlyRate] = useState(120);
  const [specialties, setSpecialties] = useState('wedding,event');

  async function saveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken) {
      return;
    }

    await apiPost(
      '/creators/apply',
      {
        portfolioUrl,
        specialties: specialties.split(',').map((item) => item.trim()).filter(Boolean),
        hourlyRate
      },
      session.user.accessToken
    );

    showToast('Portfolio and creator profile updated');
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">Portfolio Management</h1>
        <p className="mt-1 text-sm text-slate-600">Update portfolio, bio references, rates, and specialties.</p>
        <form onSubmit={saveProfile} className="mt-4 space-y-3">
          <input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Portfolio URL" />
          <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Hourly rate" />
          <input value={specialties} onChange={(e) => setSpecialties(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Specialties comma-separated" />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Save</button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Sample images</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((idx) => (
            <img key={idx} src={`https://placehold.co/260x180?text=Sample+${idx}`} alt={`Sample ${idx}`} className="rounded-md object-cover" />
          ))}
        </div>
      </section>
    </div>
  );
}
