import { BookingStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/app-error.js';

interface UpdateProfileInput {
  name?: string;
  phone?: string;
  profileImage?: string;
}

export class UserService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        verificationStatus: true,
        creatorProfile: true,
        editorProfile: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: input.name,
        phone: input.phone,
        avatarUrl: input.profileImage
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        role: true
      }
    });

    return updated;
  }

  async getUserBookings(userId: string, role?: 'customer' | 'creator') {
    const where =
      role === 'creator'
        ? { creatorId: userId }
        : role === 'customer'
          ? { customerId: userId }
          : {
              OR: [{ customerId: userId }, { creatorId: userId }]
            };

    return prisma.booking.findMany({
      where,
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
        creator: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async ensureCanViewBooking(userId: string, bookingId: string): Promise<void> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { customerId: true, creatorId: true, status: true }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (booking.customerId !== userId && booking.creatorId !== userId) {
      throw new AppError('You are not allowed to view this booking', 403);
    }

    if (booking.status === BookingStatus.CANCELED) {
      return;
    }
  }
}

export const userService = new UserService();
