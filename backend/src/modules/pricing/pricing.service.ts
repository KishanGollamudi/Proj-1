import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/app-error.js';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export class PricingService {
  async estimate(creatorId: string, at: Date) {
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: {
        id: true,
        creatorProfile: {
          select: {
            hourlyRate: true,
            city: true,
            currentSurgeMultiplier: true
          }
        }
      }
    });

    if (!creator?.creatorProfile?.hourlyRate) {
      throw new AppError('Creator not found or rate unavailable', 404);
    }

    const baseRate = Number(creator.creatorProfile.hourlyRate);
    const day = at.getDay();
    const hour = at.getHours();

    const dayMultiplier = day === 5 || day === 6 ? 1.2 : 1;
    const timeMultiplier = hour >= 18 || hour <= 6 ? 1.15 : 1;

    const localEvents = await prisma.pricingEvent.findMany({
      where: {
        isActive: true,
        startsAt: { lte: at },
        endsAt: { gte: at },
        OR: [{ city: null }, { city: creator.creatorProfile.city ?? undefined }]
      },
      orderBy: { multiplier: 'desc' },
      take: 3
    });

    const eventMultiplier = localEvents.reduce((max, item) => Math.max(max, Number(item.multiplier)), 1);

    const bookingCount30d = await prisma.booking.count({
      where: {
        creatorId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    });

    const popularityMultiplier = bookingCount30d >= 20 ? 1.2 : bookingCount30d >= 10 ? 1.1 : 1;

    const storedSurge = Number(creator.creatorProfile.currentSurgeMultiplier ?? 1);
    const multiplier = round2(Math.max(dayMultiplier * timeMultiplier * eventMultiplier * popularityMultiplier, storedSurge));
    const finalPrice = round2(baseRate * multiplier);

    return {
      creatorId,
      baseRate,
      multiplier,
      finalPrice,
      factors: {
        dayMultiplier,
        timeMultiplier,
        eventMultiplier,
        popularityMultiplier,
        storedSurge
      }
    };
  }

  async recalculateSurgeMultipliers() {
    const creators = await prisma.creatorProfile.findMany({
      select: {
        userId: true,
        city: true,
        hourlyRate: true,
        ratingAverage: true
      },
      take: 1000
    });

    for (const creator of creators) {
      if (!creator.hourlyRate) {
        continue;
      }

      const bookingCount30d = await prisma.booking.count({
        where: {
          creatorId: creator.userId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      });

      const popularityMultiplier = bookingCount30d >= 20 ? 1.25 : bookingCount30d >= 12 ? 1.15 : bookingCount30d >= 6 ? 1.07 : 1;

      await prisma.creatorProfile.update({
        where: { userId: creator.userId },
        data: {
          currentSurgeMultiplier: popularityMultiplier.toFixed(2),
          surgeContext: {
            bookingCount30d,
            updatedAt: new Date().toISOString()
          }
        }
      });
    }
  }

  async listEvents() {
    return prisma.pricingEvent.findMany({
      orderBy: { startsAt: 'desc' }
    });
  }

  async createEvent(input: { name: string; city?: string; startsAt: string; endsAt: string; multiplier: number }) {
    return prisma.pricingEvent.create({
      data: {
        name: input.name,
        city: input.city,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        multiplier: input.multiplier.toFixed(2)
      }
    });
  }
}

export const pricingService = new PricingService();
