import Link from 'next/link';
import { toCurrency } from '@snapmatch/shared';

interface CreatorCardProps {
  creator: {
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
  };
  showRelevance?: boolean;
}

export function CreatorCard({ creator, showRelevance = false }: CreatorCardProps) {
  const hourlyRate = Number(creator.creatorProfile?.hourlyRate ?? 0);
  const rating = Number(creator.creatorProfile?.ratingAverage ?? 0);
  const relevance = Math.round(Number(creator.aiRelevance ?? 0) * 100);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <img
          src={creator.avatarUrl || 'https://placehold.co/120x120?text=Creator'}
          alt={creator.fullName}
          className="h-20 w-20 rounded-md object-cover"
        />
        <div className="flex-1">
          <h3 className="text-base font-semibold text-slate-900">{creator.fullName}</h3>
          <p className="text-sm text-slate-600">
            {[creator.creatorProfile?.city, creator.creatorProfile?.country].filter(Boolean).join(', ') || 'Location TBD'}
          </p>
          <p className="mt-1 text-sm text-slate-600">Rating: {rating.toFixed(1)} / 5</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{hourlyRate ? `${toCurrency(hourlyRate)}/hr` : 'Rate on request'}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-600">{creator.creatorProfile?.bio || 'Portfolio and details available on profile.'}</p>
      <div className="mt-4 flex items-center justify-between">
        <Link href={`/creator/${creator.id}`} className="text-sm font-semibold text-slate-900 underline">
          Quick View
        </Link>
        {showRelevance ? (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
            AI match {relevance}%
          </span>
        ) : null}
      </div>
    </article>
  );
}
