import { ApplicationStatus, BookingStatus, Prisma, TransactionStatus, TransactionType, UserRole, VerificationStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

function toDateRange(from: string, to: string) {
  return {
    gte: new Date(from),
    lte: new Date(to)
  };
}

export class AdminService {
  private toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  async getKpis() {
    const [totalUsers, activeBookings, pendingDisputes, revenueAgg] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.booking.count({ where: { status: { in: [BookingStatus.REQUESTED, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] } } }),
      prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          status: TransactionStatus.SUCCEEDED,
          type: { in: [TransactionType.BOOKING_PAYMENT, TransactionType.SUBSCRIPTION_CHARGE] }
        }
      })
    ]);

    return {
      totalUsers,
      activeBookings,
      pendingDisputes,
      revenue: Number(revenueAgg._sum.amount ?? 0)
    };
  }

  async listUsers(filters: { role?: UserRole; verificationStatus?: VerificationStatus; isActive?: boolean; page: number; limit: number }) {
    return prisma.user.findMany({
      where: {
        ...(filters.role ? { role: filters.role } : {}),
        ...(filters.verificationStatus ? { verificationStatus: filters.verificationStatus } : {}),
        ...(typeof filters.isActive === 'boolean' ? { isActive: filters.isActive } : {}),
        deletedAt: null
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        verificationStatus: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit
    });
  }

  async verifyUser(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: VerificationStatus.VERIFIED }
    });
  }

  async suspendUser(userId: string) {
    return prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  }

  async softDeleteUser(userId: string) {
    return prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date(), isActive: false } });
  }

  async listCreators(filters: { applicationStatus?: ApplicationStatus; featured?: boolean }) {
    return prisma.user.findMany({
      where: {
        role: UserRole.CREATOR,
        creatorProfile: {
          is: {
            ...(filters.applicationStatus ? { applicationStatus: filters.applicationStatus } : {}),
            ...(typeof filters.featured === 'boolean' ? { isFeatured: filters.featured } : {})
          }
        }
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        creatorProfile: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async reviewCreator(userId: string, status: ApplicationStatus) {
    return prisma.creatorProfile.update({
      where: { userId },
      data: {
        applicationStatus: status,
        isAvailable: status === ApplicationStatus.APPROVED
      }
    });
  }

  async setCreatorFeatured(userId: string, featured: boolean) {
    return prisma.creatorProfile.update({ where: { userId }, data: { isFeatured: featured } });
  }

  async listEditors(filters: { applicationStatus?: ApplicationStatus; featured?: boolean }) {
    return prisma.user.findMany({
      where: {
        role: UserRole.EDITOR,
        editorProfile: {
          is: {
            ...(filters.applicationStatus ? { applicationStatus: filters.applicationStatus } : {}),
            ...(typeof filters.featured === 'boolean' ? { isFeatured: filters.featured } : {})
          }
        }
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        editorProfile: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async reviewEditor(userId: string, status: ApplicationStatus) {
    return prisma.editorProfile.update({
      where: { userId },
      data: {
        applicationStatus: status,
        isAvailable: status === ApplicationStatus.APPROVED
      }
    });
  }

  async setEditorFeatured(userId: string, featured: boolean) {
    return prisma.editorProfile.update({ where: { userId }, data: { isFeatured: featured } });
  }

  async listBookings(filters: { status?: BookingStatus; page: number; limit: number }) {
    return prisma.booking.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {})
      },
      include: {
        customer: { select: { id: true, fullName: true } },
        creator: { select: { id: true, fullName: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit
    });
  }

  async listTransactions(filters: { type?: TransactionType; status?: TransactionStatus; page: number; limit: number }) {
    return prisma.transaction.findMany({
      where: {
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { status: filters.status } : {})
      },
      include: {
        payer: { select: { id: true, fullName: true } },
        payee: { select: { id: true, fullName: true } },
        booking: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit
    });
  }

  async analyticsReport(input: { from: string; to: string; metrics?: string }) {
    const dateRange = toDateRange(input.from, input.to);

    const [bookings, disputes, users, tx] = await Promise.all([
      prisma.booking.findMany({ where: { createdAt: dateRange }, select: { createdAt: true, status: true } }),
      prisma.dispute.findMany({ where: { createdAt: dateRange }, select: { createdAt: true, status: true } }),
      prisma.user.findMany({ where: { createdAt: dateRange }, select: { createdAt: true, role: true } }),
      prisma.transaction.findMany({
        where: {
          createdAt: dateRange,
          status: TransactionStatus.SUCCEEDED
        },
        select: { createdAt: true, amount: true, type: true }
      })
    ]);

    return {
      summary: {
        bookings: bookings.length,
        disputes: disputes.length,
        users: users.length,
        revenue: tx.reduce((sum, item) => sum + Number(item.amount), 0)
      },
      timeseries: {
        bookings,
        disputes,
        transactions: tx
      }
    };
  }

  async getSettings() {
    const settings = await prisma.platformSetting.findMany();
    const map = Object.fromEntries(settings.map((item) => [item.key, item.value]));

    return {
      commissionPercent: map.commissionPercent ?? 15,
      surgeParams: map.surgeParams ?? { base: 1, peakHourBoost: 1.15 },
      emailTemplates: map.emailTemplates ?? { bookingConfirmed: 'Default template' }
    };
  }

  async updateSettings(input: { commissionPercent?: number; surgeParams?: Record<string, unknown>; emailTemplates?: Record<string, unknown> }) {
    const operations: Prisma.PrismaPromise<unknown>[] = [];

    if (typeof input.commissionPercent === 'number') {
      operations.push(
        prisma.platformSetting.upsert({
          where: { key: 'commissionPercent' },
          create: { key: 'commissionPercent', value: input.commissionPercent },
          update: { value: input.commissionPercent }
        })
      );
    }

    if (input.surgeParams) {
      operations.push(
        prisma.platformSetting.upsert({
          where: { key: 'surgeParams' },
          create: { key: 'surgeParams', value: this.toJsonValue(input.surgeParams) },
          update: { value: this.toJsonValue(input.surgeParams) }
        })
      );
    }

    if (input.emailTemplates) {
      operations.push(
        prisma.platformSetting.upsert({
          where: { key: 'emailTemplates' },
          create: { key: 'emailTemplates', value: this.toJsonValue(input.emailTemplates) },
          update: { value: this.toJsonValue(input.emailTemplates) }
        })
      );
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    return this.getSettings();
  }
}

export const adminService = new AdminService();
