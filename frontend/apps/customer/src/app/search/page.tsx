'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { CreatorCard } from '@/components/creator-card';
import { apiGet } from '@/lib/api';
import { LoadingSpinner } from '@snapmatch/shared';

interface CreatorItem {
  id: string;
  fullName: string;
  aiRelevance?: number;
  avatarUrl?: string | null;
  creatorProfile?: {
    city?: string | null;
    country?: string | null;
    hourlyRate?: string | null;
    ratingAverage?: string | null;
    bio?: string | null;
  } | null;
}

export default function SearchPage() {
  const params = useSearchParams();

  const q = params.get('q') ?? '';
  const location = params.get('location') ?? '';
  const specialty = params.get('specialty') ?? '';
  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';
  const minRating = params.get('minRating') ?? '';
  const sort = params.get('sort') ?? 'rating';

  const { data, isLoading } = useQuery({
    queryKey: ['creators', q, location, specialty, minPrice, maxPrice, minRating, sort],
    queryFn: () =>
      apiGet<CreatorItem[]>('/creators', undefined, {
        q: q || undefined,
        location,
        specialty,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        minRating: minRating || undefined
      })
  });

  const creators = [...(data ?? [])].sort((a, b) => {
    if (q && (sort === 'relevance' || sort === 'rating')) {
      return (Number(b.aiRelevance ?? 0) - Number(a.aiRelevance ?? 0));
    }

    const priceA = Number(a.creatorProfile?.hourlyRate ?? 0);
    const priceB = Number(b.creatorProfile?.hourlyRate ?? 0);
    const ratingA = Number(a.creatorProfile?.ratingAverage ?? 0);
    const ratingB = Number(b.creatorProfile?.ratingAverage ?? 0);

    if (sort === 'price') {
      return priceA - priceB;
    }

    if (sort === 'rating') {
      return ratingB - ratingA;
    }

    return ratingB - ratingA;
  });

  const activeSort = q && sort === 'rating' ? 'relevance' : sort;

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Filters</h2>
        <p className="mt-2 text-sm text-slate-600">Filters are driven by URL query params.</p>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          <li>AI query: {q || 'None'}</li>
          <li>Location: {location || 'Any'}</li>
          <li>Specialty: {specialty || 'Any'}</li>
          <li>Price: {minPrice || '0'} - {maxPrice || 'Any'}</li>
          <li>Rating: {minRating || 'Any'}</li>
          <li>Sort: {activeSort}</li>
        </ul>
      </aside>
      <section>
        <h1 className="mb-4 text-2xl font-semibold text-slate-900">Search Results</h1>
        {isLoading ? (
          <LoadingSpinner label="Loading creators" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {creators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} showRelevance={Boolean(q)} />
            ))}
            {creators.length === 0 ? <p className="text-sm text-slate-600">No creators matched your filters.</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}
