import { API_BASE_URL } from '@/lib/api';
import { BookingWidget } from '@/components/booking-widget';

export const revalidate = 300;

interface CreatorProfileResponse {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  creatorProfile?: {
    bio?: string | null;
    hourlyRate?: string | null;
    portfolioUrl?: string | null;
  } | null;
}

async function getCreator(id: string): Promise<CreatorProfileResponse | null> {
  const response = await fetch(`${API_BASE_URL}/creators/${id}`, { next: { revalidate } });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as CreatorProfileResponse;
}

async function getReviews(id: string): Promise<Array<{ id: string; rating: number; comment?: string | null }>> {
  const response = await fetch(`${API_BASE_URL}/creators/${id}/reviews`, { next: { revalidate } });
  if (!response.ok) {
    return [];
  }
  return (await response.json()) as Array<{ id: string; rating: number; comment?: string | null }>;
}

async function getAvailability(id: string): Promise<Array<{ startAt: string; available: boolean }>> {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setHours(startDate.getHours() + 12);
  const query = new URLSearchParams({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  const response = await fetch(`${API_BASE_URL}/creators/${id}/availability?${query.toString()}`, { cache: 'no-store' });
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as { slots?: Array<{ startAt: string; available: boolean }> };
  return payload.slots ?? [];
}

export default async function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [creator, reviews, availabilitySlots] = await Promise.all([getCreator(id), getReviews(id), getAvailability(id)]);

  if (!creator) {
    return <p className="text-sm text-slate-600">Creator not found.</p>;
  }

  const hourlyRate = Number(creator.creatorProfile?.hourlyRate ?? 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-4">
            <img
              src={creator.avatarUrl || 'https://placehold.co/140x140?text=Creator'}
              alt={creator.fullName}
              className="h-24 w-24 rounded-md object-cover"
              loading="lazy"
              decoding="async"
            />
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{creator.fullName}</h1>
              <p className="mt-2 text-sm text-slate-600">{creator.creatorProfile?.bio || 'No bio yet.'}</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{hourlyRate ? `$${hourlyRate}/hr` : 'Rate on request'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Portfolio</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <img
                key={idx}
                src={`https://placehold.co/360x240?text=Portfolio+${idx}`}
                alt={`Portfolio ${idx}`}
                className="h-28 w-full rounded-md object-cover"
                loading="lazy"
                decoding="async"
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Availability</h2>
          <p className="mt-2 text-sm text-slate-600">Upcoming open and booked time slots for the next 12 hours.</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            {availabilitySlots.slice(0, 9).map((slot) => (
              <div key={slot.startAt} className={`rounded px-2 py-2 text-center ${slot.available ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {slot.available ? 'Open' : 'Booked'}
              </div>
            ))}
            {availabilitySlots.length === 0 ? <p className="col-span-3 text-sm text-slate-600">Availability data is not available right now.</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Reviews</h2>
          <div className="mt-3 space-y-3">
            {reviews.length === 0 ? <p className="text-sm text-slate-600">No reviews yet.</p> : null}
            {reviews.map((review) => (
              <div key={review.id} className="rounded-md border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">Rating: {review.rating}/5</p>
                <p className="mt-1 text-slate-600">{review.comment || 'No comment provided.'}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside>
        <BookingWidget creatorId={creator.id} hourlyRate={hourlyRate || 100} />
      </aside>
    </div>
  );
}
