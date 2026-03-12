import Link from 'next/link';
import { API_BASE_URL } from '@/lib/api';
import { CreatorCard } from '@/components/creator-card';
import { LandingSearch } from '@/components/landing-search';
import { PersonalizedRecommendations } from '@/components/personalized-recommendations';

export const revalidate = 300;

interface CreatorItem {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  creatorProfile?: {
    city?: string | null;
    country?: string | null;
    hourlyRate?: string | null;
    ratingAverage?: string | null;
    bio?: string | null;
  } | null;
}

async function getFeaturedCreators(): Promise<CreatorItem[]> {
  const response = await fetch(`${API_BASE_URL}/creators?limit=3`, { next: { revalidate } });
  if (!response.ok) {
    return [];
  }
  return (await response.json()) as CreatorItem[];
}

export default async function HomePage() {
  const creators = await getFeaturedCreators();

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-12 text-white">
        <p className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs uppercase tracking-wide">SnapMatch Marketplace</p>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Book trusted creators for your next event</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-200 sm:text-base">
          Search by location, compare pricing, and reserve your photographer or videographer in minutes.
        </p>
        <LandingSearch />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Featured creators</h2>
          <Link href="/search" className="text-sm font-semibold text-slate-900 underline">View all</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {creators.map((creator) => (
            <CreatorCard key={creator.id} creator={creator} />
          ))}
        </div>
      </section>

      <PersonalizedRecommendations />

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-3">
        <div>
          <h3 className="font-semibold text-slate-900">1. Discover</h3>
          <p className="mt-2 text-sm text-slate-600">Browse creators by location, specialty, and budget.</p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">2. Book</h3>
          <p className="mt-2 text-sm text-slate-600">Select a date, pay securely, and receive confirmation instantly.</p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">3. Receive</h3>
          <p className="mt-2 text-sm text-slate-600">Get event coverage and final media delivery after completion.</p>
        </div>
      </section>
    </div>
  );
}
