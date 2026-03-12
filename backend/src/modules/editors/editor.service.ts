import { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { paymentService, PaymentService } from '../payments/payment.service.js';

interface ApplyEditorInput {
  bio?: string;
  specialties: string[];
  software: string[];
  hourlyRate: number;
  portfolioUrl?: string;
  turnaroundHours?: number;
}

interface ListEditorFilters {
  specialty?: string;
  software?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  page: number;
  limit: number;
}

export class EditorService {
  constructor(private readonly payments: PaymentService = paymentService) {}

  async apply(userId: string, email: string, input: ApplyEditorInput) {
    const stripe = await this.payments.createConnectedAccountForCreator(userId, email);

    const editor = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role: UserRole.EDITOR }
      });

      return tx.editorProfile.upsert({
        where: { userId },
        create: {
          userId,
          bio: input.bio,
          specialties: input.specialties,
          tools: input.software,
          hourlyRate: input.hourlyRate.toFixed(2),
          portfolioUrl: input.portfolioUrl,
          turnaroundHours: input.turnaroundHours,
          stripeAccountId: stripe.accountId,
          applicationStatus: 'PENDING',
          isAvailable: false
        },
        update: {
          bio: input.bio,
          specialties: input.specialties,
          tools: input.software,
          hourlyRate: input.hourlyRate.toFixed(2),
          portfolioUrl: input.portfolioUrl,
          turnaroundHours: input.turnaroundHours,
          stripeAccountId: stripe.accountId,
          applicationStatus: 'PENDING',
          isAvailable: false
        }
      });
    });

    return {
      ...editor,
      stripeOnboardingUrl: stripe.onboardingUrl
    };
  }

  async list(filters: ListEditorFilters) {
    return prisma.user.findMany({
      where: {
        role: UserRole.EDITOR,
        editorProfile: {
          is: {
            isAvailable: true,
            applicationStatus: 'APPROVED',
            ...(filters.specialty
              ? {
                  specialties: {
                    has: filters.specialty
                  }
                }
              : {}),
            ...(filters.software
              ? {
                  tools: {
                    has: filters.software
                  }
                }
              : {}),
            ...(filters.minPrice || filters.maxPrice
              ? {
                  hourlyRate: {
                    gte: filters.minPrice?.toFixed(2),
                    lte: filters.maxPrice?.toFixed(2)
                  }
                }
              : {}),
            ...(filters.minRating
              ? {
                  ratingAverage: {
                    gte: filters.minRating.toFixed(2)
                  }
                }
              : {})
          }
        }
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        editorProfile: true
      },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      orderBy: { createdAt: 'desc' }
    });
  }

  async getById(editorId: string) {
    const editor = await prisma.user.findFirst({
      where: {
        id: editorId,
        role: UserRole.EDITOR
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        createdAt: true,
        editorProfile: true
      }
    });

    if (!editor) {
      throw new AppError('Editor not found', 404);
    }

    return editor;
  }

  async updateAvailability(userId: string, isAvailable: boolean) {
    return prisma.editorProfile.update({
      where: { userId },
      data: { isAvailable }
    });
  }
}

export const editorService = new EditorService();
