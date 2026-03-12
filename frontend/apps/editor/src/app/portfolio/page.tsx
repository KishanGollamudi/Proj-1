'use client';

import { FormEvent, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiPost, apiPut } from '@/lib/api';
import { useToast } from '@snapmatch/shared';

export default function PortfolioPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [portfolioUrl, setPortfolioUrl] = useState('https://portfolio.example.com');
  const [hourlyRate, setHourlyRate] = useState(80);
  const [specialties, setSpecialties] = useState('wedding,color-grading');
  const [software, setSoftware] = useState('lightroom,premiere');
  const [bio, setBio] = useState('Commercial photo/video editor with fast turnaround.');
  const [turnaroundHours, setTurnaroundHours] = useState(48);

  async function saveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.user?.accessToken) {
      return;
    }

    await apiPost(
      '/editors/apply',
      {
        bio,
        portfolioUrl,
        specialties: specialties.split(',').map((item) => item.trim()).filter(Boolean),
        software: software.split(',').map((item) => item.trim()).filter(Boolean),
        hourlyRate,
        turnaroundHours
      },
      session.user.accessToken
    );

    showToast('Editor profile updated');
  }

  async function toggleAvailability(isAvailable: boolean): Promise<void> {
    if (!session?.user?.accessToken) {
      return;
    }

    await apiPut('/editors/availability', { isAvailable }, session.user.accessToken);
    showToast(`Availability ${isAvailable ? 'enabled' : 'paused'}`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">Editor Profile</h1>
        <p className="mt-1 text-sm text-slate-600">Control specialties, tooling, rate, and portfolio used in matching.</p>
        <form onSubmit={saveProfile} className="mt-4 space-y-3">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Bio" />
          <input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Portfolio URL" />
          <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Hourly rate" />
          <input type="number" value={turnaroundHours} onChange={(e) => setTurnaroundHours(Number(e.target.value))} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Turnaround (hours)" />
          <input value={specialties} onChange={(e) => setSpecialties(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Specialties comma-separated" />
          <input value={software} onChange={(e) => setSoftware(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Software comma-separated" />
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Save Profile</button>
            <button type="button" onClick={() => toggleAvailability(true)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">Set Available</button>
            <button type="button" onClick={() => toggleAvailability(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">Pause Availability</button>
          </div>
        </form>
      </section>
    </div>
  );
}
