import { BookingStatus, TransactionStatus, TransactionType, UserRole } from '@prisma/client';
import { logger } from '../../config/logger.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { addHours, rangesOverlap } from '../../utils/date.js';
import { emailService, EmailService } from '../email/email.service.js';
import { paymentService, PaymentService } from '../payments/payment.service.js';

interface CreateBookingInput {
  creatorId: string;
  eventDate: string;
  startTime: string;
  durationHours: number;
  location: string;
  specialInstructions?: string;
  paymentMethodId?: string;
  useSubscriptionCredits?: boolean;
}

type CreatedBookingResult = Awaited<ReturnType<typeof prisma.booking.create>> & {
  paymentIntentId: string | null;
  paymentStatus: string | null;
};

const bookingIdempotencyMap = new Map<string, string>();

export class BookingService {
  constructor(
    private readonly payments: PaymentService = paymentService,
    private readonly mailer: EmailService = emailService
  ) {}

  private buildTimeRange(eventDate: string, startTime: string, durationHours: number): { startAt: Date; endAt: Date } {
    const [hours = 0, minutes = 0] = startTime.split(':').map((value) => Number(value));
    const event = new Date(eventDate);
    event.setHours(hours, minutes, 0, 0);

    return {
      startAt: event,
      endAt: addHours(event, durationHours)
    };
  }

  private async assertCreatorAvailable(creatorId: string, startAt: Date, endAt: Date): Promise<void> {
    const creator = await prisma.user.findFirst({
      where: { id: creatorId, role: UserRole.CREATOR },
      include: { creatorProfile: true }
    });

    if (!creator?.creatorProfile) {
      throw new AppError('Creator profile not found', 404);
    }

    if (!creator.creatorProfile.isAvailable) {
      throw new AppError('Creator is currently unavailable', 409);
    }

    const bookings = await prisma.booking.findMany({
      where: {
        creatorId,
        status: { in: [BookingStatus.REQUESTED, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
        startAt: { not: null },
        endAt: { not: null }
      },
      select: {
        startAt: true,
        endAt: true
      }
    });

    const overlapping = bookings.some((booking) => {
      if (!booking.startAt || !booking.endAt) {
        return false;
      }
      return rangesOverlap(startAt, endAt, booking.startAt, booking.endAt);
    });

    if (overlapping) {
      throw new AppError('Creator is not available in the selected time slot', 409);
    }
  }

  async create(customerId: string, input: CreateBookingInput, idempotencyKey: string): Promise<CreatedBookingResult> {
    const existingBookingId = bookingIdempotencyMap.get(idempotencyKey);
    if (existingBookingId) {
      const existing = await prisma.booking.findUnique({ where: { id: existingBookingId } });
      if (existing) {
        logger.info('Returning booking from idempotency cache', { bookingId: existing.id, customerId });
        return {
          ...existing,
          paymentIntentId: null,
          paymentStatus: null
        };
      }
    }

    const creator = await prisma.user.findUnique({
      where: { id: input.creatorId },
      include: { creatorProfile: true }
    });

    if (!creator?.creatorProfile?.hourlyRate) {
      throw new AppError('Creator hourly rate is not configured', 400);
    }

    const { startAt, endAt } = this.buildTimeRange(input.eventDate, input.startTime, input.durationHours);
    await this.assertCreatorAvailable(input.creatorId, startAt, endAt);

    const hourlyRate = Number(creator.creatorProfile.hourlyRate);
    const totalPrice = Math.round(hourlyRate * input.durationHours * 100);

    const booking = await prisma.booking.create({
      data: {
        customerId,
        creatorId: input.creatorId,
        title: `Booking with ${creator.fullName}`,
        description: input.specialInstructions,
        eventDate: new Date(input.eventDate),
        startAt,
        endAt,
        location: input.location,
        budget: (totalPrice / 100).toFixed(2),
        currency: 'USD',
        status: BookingStatus.REQUESTED
      }
    });

    let paymentIntentId: string | null = null;
    let paymentStatus: string | null = null;

    if (input.useSubscriptionCredits) {
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId: customerId,
          status: 'ACTIVE'
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!subscription) {
        throw new AppError('Active subscription required to use credits', 409);
      }

      const availableCredits = Number(subscription.includedHours) + Number(subscription.bonusHours) - Number(subscription.usedHours);
      if (availableCredits < input.durationHours) {
        throw new AppError('Insufficient subscription credits. Please top up or pay normally.', 409);
      }

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          usedHours: (Number(subscription.usedHours) + input.durationHours).toFixed(2)
        }
      });

      await prisma.transaction.create({
        data: {
          bookingId: booking.id,
          subscriptionId: subscription.id,
          payerId: customerId,
          payeeId: input.creatorId,
          type: TransactionType.SUBSCRIPTION_CHARGE,
          status: TransactionStatus.SUCCEEDED,
          amount: (hourlyRate * input.durationHours).toFixed(2),
          currency: 'USD',
          metadata: {
            source: 'subscription_credits',
            hoursUsed: input.durationHours
          }
        }
      });

      paymentStatus = 'subscription_credits_used';
    } else {
      if (!input.paymentMethodId) {
        throw new AppError('paymentMethodId is required unless using subscription credits', 400);
      }

      const paymentIntent = await this.payments.createEscrowPaymentIntent({
        bookingId: booking.id,
        customerId,
        amount: totalPrice,
        currency: 'usd',
        paymentMethodId: input.paymentMethodId,
        idempotencyKey
      });
      paymentIntentId = paymentIntent.id;
      paymentStatus = paymentIntent.status;
    }

    bookingIdempotencyMap.set(idempotencyKey, booking.id);
    logger.info('Booking created with escrow intent', {
      bookingId: booking.id,
      customerId,
      creatorId: input.creatorId,
      paymentIntentId
    });

    const customer = await prisma.user.findUnique({ where: { id: customerId } });

    if (customer) {
      await Promise.all([
        this.mailer.sendBookingConfirmation(customer.email, booking.id),
        this.mailer.sendBookingConfirmation(creator.email, booking.id)
      ]);
    }

    return {
      ...booking,
      paymentIntentId,
      paymentStatus
    };
  }

  async listByUser(userId: string, role?: 'customer' | 'creator') {
    return prisma.booking.findMany({
      where:
        role === 'creator'
          ? { creatorId: userId }
          : role === 'customer'
            ? { customerId: userId }
            : {
                OR: [{ customerId: userId }, { creatorId: userId }]
              },
      include: {
        customer: {
          select: { id: true, fullName: true, email: true }
        },
        creator: {
          select: { id: true, fullName: true, email: true }
        },
        transactions: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getById(userId: string, bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
        creator: { select: { id: true, fullName: true, email: true } },
        transactions: true,
        reviews: true,
        mediaAssets: {
          select: {
            id: true,
            fileName: true,
            originalUrl: true,
            mimeType: true,
            status: true
          },
          orderBy: { uploadedAt: 'desc' }
        }
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (booking.customerId !== userId && booking.creatorId !== userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (user?.role !== UserRole.ADMIN) {
        throw new AppError('You cannot access this booking', 403);
      }
    }

    return booking;
  }

  async cancel(userId: string, bookingId: string, reason?: string) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const authorized = booking.customerId === userId || booking.creatorId === userId || user?.role === UserRole.ADMIN;

    if (!authorized) {
      throw new AppError('Not authorized to cancel this booking', 403);
    }

    const canceled = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELED,
        cancellationReason: reason
      }
    });

    const hasPayment = await prisma.transaction.findFirst({
      where: {
        bookingId,
        type: TransactionType.BOOKING_PAYMENT
      }
    });

    if (hasPayment) {
      await this.payments.refundBooking(bookingId, reason);
    }

    return canceled;
  }

  async confirm(bookingId: string) {
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED }
    });
    logger.info('Booking confirmed', { bookingId });

    const users = await prisma.user.findMany({
      where: { id: { in: [booking.customerId, booking.creatorId] } },
      select: { email: true }
    });

    await Promise.all(users.map((user) => this.mailer.sendPaymentReceived(user.email, booking.id)));
    return booking;
  }

  async complete(userId: string, bookingId: string) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (booking.customerId !== userId && user?.role !== UserRole.ADMIN) {
      throw new AppError('Only customer or admin can complete booking', 403);
    }

    const completionReference = booking.endAt ?? booking.eventDate;
    if (completionReference > new Date()) {
      throw new AppError('Booking can only be completed after the event time', 409);
    }

    await this.payments.captureEscrow(bookingId);

    const completed = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.COMPLETED
      }
    });

    logger.info('Booking completed and escrow captured', { bookingId, completedBy: userId });
    return completed;
  }
}

export const bookingService = new BookingService();
