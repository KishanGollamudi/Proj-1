import { ApplicationStatus, Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redisConnection } from '../../lib/redis.js';
import { AppError } from '../../utils/app-error.js';
import { addHours } from '../../utils/date.js';
import { paymentService, PaymentService } from '../payments/payment.service.js';
import { pineconeIndexService } from '../ai/pinecone-index.service.js';
import { CreatorScore, searchService, SearchFilters } from '../ai/search.service.js';

interface ApplyCreatorInput {
  portfolioUrl: string;
  specialties: string[];
  hourlyRate: number;
  businessName?: string;
  city?: string;
  country?: string;
  timezone?: string;
}

interface CreatorFilters {
  q?: string;
  location?: string;
  specialty?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  page: number;
  limit: number;
}

type CreatorListItem = Prisma.UserGetPayload<{
  select: {
    id: true;
    fullName: true;
    avatarUrl: true;
    creatorProfile: true;
  };
}>;

export class CreatorService {
  constructor(private readonly payments: PaymentService = paymentService) {}

  private buildWhere(filters: SearchFilters): Prisma.UserWhereInput {
    const creatorProfileWhere: Prisma.CreatorProfileWhereInput = {
      isAvailable: true,
      applicationStatus: ApplicationStatus.APPROVED
    };

    if (filters.location) {
      creatorProfileWhere.OR = [
        { city: { contains: filters.location, mode: 'insensitive' } },
        { country: { contains: filters.location, mode: 'insensitive' } }
      ];
    }

    if (filters.specialty) {
      creatorProfileWhere.bio = { contains: filters.specialty, mode: 'insensitive' };
    }

    if (filters.minPrice || filters.maxPrice) {
      creatorProfileWhere.hourlyRate = {
        ...(filters.minPrice ? { gte: filters.minPrice.toFixed(2) } : {}),
        ...(filters.maxPrice ? { lte: filters.maxPrice.toFixed(2) } : {})
      };
    }

    if (filters.minRating) {
      creatorProfileWhere.ratingAverage = { gte: filters.minRating.toFixed(2) };
    }

    return {
      role: UserRole.CREATOR,
      creatorProfile: {
        is: creatorProfileWhere
      }
    };
  }

  private mergeFilters(base: CreatorFilters, ai: SearchFilters): SearchFilters {
    return {
      location: base.location ?? ai.location,
      specialty: base.specialty ?? ai.specialty,
      minPrice: base.minPrice ?? ai.minPrice,
      maxPrice: base.maxPrice ?? ai.maxPrice,
      minRating: base.minRating ?? ai.minRating
    };
  }

  async apply(userId: string, email: string, input: ApplyCreatorInput) {
    const creatorData = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { role: UserRole.CREATOR }
      });

      const profile = await tx.creatorProfile.upsert({
        where: { userId },
        create: {
          userId,
          businessName: input.businessName,
          portfolioUrl: input.portfolioUrl,
          hourlyRate: input.hourlyRate.toFixed(2),
          city: input.city,
          country: input.country,
          timezone: input.timezone,
          bio: input.specialties.length > 0 ? `Specialties: ${input.specialties.join(', ')}` : null,
          applicationStatus: 'PENDING',
          isAvailable: false
        },
        update: {
          businessName: input.businessName,
          portfolioUrl: input.portfolioUrl,
          hourlyRate: input.hourlyRate.toFixed(2),
          city: input.city,
          country: input.country,
          timezone: input.timezone,
          bio: input.specialties.length > 0 ? `Specialties: ${input.specialties.join(', ')}` : undefined,
          applicationStatus: 'PENDING',
          isAvailable: false
        }
      });

      return { user, profile };
    });

    const stripe = await this.payments.createConnectedAccountForCreator(userId, email);
    await pineconeIndexService.upsertCreatorEmbeddings([userId]);

    return {
      ...creatorData.profile,
      stripeOnboardingUrl: stripe.onboardingUrl,
      stripeAccountId: stripe.accountId
    };
  }

  async list(filters: CreatorFilters) {
    const cacheKey = `creators:list:${JSON.stringify(filters)}`;
    if (redisConnection) {
      const cached = await redisConnection.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as CreatorListItem[];
      }
    }

    if (!filters.q) {
      const creators: CreatorListItem[] = await prisma.user.findMany({
        where: this.buildWhere(filters),
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          creatorProfile: true
        },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' }
      });

      if (redisConnection) {
        await redisConnection.set(cacheKey, JSON.stringify(creators), 'EX', 90);
      }
      return creators;
    }

    const parsed = await searchService.parseNaturalLanguage(filters.q);
    const mergedFilters = this.mergeFilters(filters, parsed);
    const where = this.buildWhere(mergedFilters);

    const candidates: CreatorListItem[] = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        creatorProfile: true
      },
      take: Math.max(filters.limit * 5, 60),
      orderBy: { createdAt: 'desc' }
    });
    const normalizedCandidates = candidates.map((creator) => ({
      ...creator,
      creatorProfile: creator.creatorProfile
        ? {
            ...creator.creatorProfile,
            hourlyRate: creator.creatorProfile.hourlyRate ? Number(creator.creatorProfile.hourlyRate) : null,
            ratingAverage: creator.creatorProfile.ratingAverage ? Number(creator.creatorProfile.ratingAverage) : null
          }
        : null
    }));

    const queryEmbedding = await searchService.generateEmbedding(filters.q);
    const vectorScores = await searchService.vectorSearch(queryEmbedding, 100);
    const ranked = await searchService.rankCreators(normalizedCandidates, queryEmbedding, {
      vectorScores,
      textQuery: filters.q
    });

    const explicitFiltered = this.applyVectorFallback(ranked, vectorScores);
    const start = (filters.page - 1) * filters.limit;
    const end = start + filters.limit;
    const result = explicitFiltered.slice(start, end);
    if (redisConnection) {
      await redisConnection.set(cacheKey, JSON.stringify(result), 'EX', 90);
      await redisConnection.zincrby('search:popular:queries', 1, filters.q);
    }
    return result;
  }

  private applyVectorFallback(creators: Awaited<ReturnType<typeof searchService.rankCreators>>, vectorScores: CreatorScore[]) {
    if (vectorScores.length === 0) {
      return creators;
    }

    const scoreMap = new Map(vectorScores.map((item) => [item.creatorId, item.score]));
    return creators
      .map((creator) => ({
        ...creator,
        aiRelevance: creator.aiRelevance ?? scoreMap.get(creator.id) ?? 0
      }))
      .sort((a, b) => (b.aiRelevance ?? 0) - (a.aiRelevance ?? 0));
  }

  async getById(userId: string) {
    const creator = await prisma.user.findFirst({
      where: {
        id: userId,
        role: UserRole.CREATOR
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        createdAt: true,
        creatorProfile: true
      }
    });

    if (!creator) {
      throw new AppError('Creator not found', 404);
    }

    return creator;
  }

  async updateAvailability(userId: string, isAvailable: boolean) {
    return prisma.creatorProfile.update({
      where: { userId },
      data: { isAvailable }
    });
  }

  async getAvailability(creatorId: string, startDate: Date, endDate: Date) {
    const profile = await prisma.creatorProfile.findUnique({ where: { userId: creatorId } });

    if (!profile) {
      throw new AppError('Creator profile not found', 404);
    }

    const bookings = await prisma.booking.findMany({
      where: {
        creatorId,
        status: { in: ['REQUESTED', 'CONFIRMED', 'IN_PROGRESS'] },
        startAt: { lt: endDate },
        endAt: { gt: startDate }
      },
      select: {
        startAt: true,
        endAt: true,
        status: true
      }
    });

    const slots: Array<{ startAt: Date; endAt: Date; available: boolean }> = [];
    const slotCursor = new Date(startDate);

    while (slotCursor < endDate) {
      const slotEnd = addHours(slotCursor, 1);
      const overlaps = bookings.some((booking) => {
        if (!booking.startAt || !booking.endAt) {
          return false;
        }
        return slotCursor < booking.endAt && booking.startAt < slotEnd;
      });

      slots.push({ startAt: new Date(slotCursor), endAt: slotEnd, available: profile.isAvailable && !overlaps });
      slotCursor.setHours(slotCursor.getHours() + 1);
    }

    return {
      creatorId,
      isAvailable: profile.isAvailable,
      busyRanges: bookings,
      slots
    };
  }

  async getReviews(creatorId: string) {
    return prisma.review.findMany({
      where: {
        booking: {
          creatorId
        }
      },
      include: {
        reviewer: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export const creatorService = new CreatorService();
