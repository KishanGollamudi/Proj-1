import { prisma } from '../../lib/prisma.js';

export class RecommendationService {
  async forUser(userId: string) {
    const myBookings = await prisma.booking.findMany({
      where: { customerId: userId },
      select: { creatorId: true }
    });

    const myCreatorIds = myBookings.map((item) => item.creatorId);

    if (myCreatorIds.length === 0) {
      return prisma.user.findMany({
        where: { role: 'CREATOR' },
        select: { id: true, fullName: true, avatarUrl: true, creatorProfile: true },
        take: 8,
        orderBy: { createdAt: 'desc' }
      });
    }

    const similarCustomers = await prisma.booking.findMany({
      where: { creatorId: { in: myCreatorIds } },
      select: { customerId: true },
      take: 300
    });

    const similarCustomerIds = [...new Set(similarCustomers.map((item) => item.customerId).filter((id) => id !== userId))];

    const collaborative = await prisma.booking.groupBy({
      by: ['creatorId'],
      where: {
        customerId: { in: similarCustomerIds },
        creatorId: { notIn: myCreatorIds }
      },
      _count: { creatorId: true },
      orderBy: { _count: { creatorId: 'desc' } },
      take: 12
    });

    const ids = collaborative.map((item) => item.creatorId);
    if (ids.length === 0) {
      return prisma.user.findMany({
        where: { role: 'CREATOR', id: { notIn: myCreatorIds } },
        select: { id: true, fullName: true, avatarUrl: true, creatorProfile: true },
        take: 8,
        orderBy: { createdAt: 'desc' }
      });
    }

    const creators = await prisma.user.findMany({
      where: { role: 'CREATOR', id: { in: ids } },
      select: { id: true, fullName: true, avatarUrl: true, creatorProfile: true }
    });

    const order = new Map(ids.map((id, idx) => [id, idx]));
    return creators.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  }
}

export const recommendationService = new RecommendationService();
