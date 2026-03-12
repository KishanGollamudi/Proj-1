'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { CreatorCard } from './creator-card';

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

export function PersonalizedRecommendations() {
  const { data: session } = useSession();

  const { data } = useQuery({
    queryKey: ['recommendations', session?.user?.id],
    queryFn: () => apiGet<CreatorItem[]>('/recommendations', session?.user?.accessToken),
    enabled: Boolean(session?.user?.accessToken)
  });

  if (!session?.user?.accessToken || (data ?? []).length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Recommended for you</h2>
        <Link href="/search" className="text-sm font-semibold text-slate-900 underline">See more</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {(data ?? []).slice(0, 3).map((creator) => (
          <CreatorCard key={creator.id} creator={creator} />
        ))}
      </div>
    </section>
  );
}
