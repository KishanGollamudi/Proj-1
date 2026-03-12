import { BookingStatus, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { BookingService } from './booking.service.js';

jest.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn()
    },
    booking: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    transaction: {
      findFirst: jest.fn()
    }
  }
}));

describe('BookingService', () => {
  const mockPayments = {
    createEscrowPaymentIntent: jest.fn(),
    refundBooking: jest.fn(),
    captureEscrow: jest.fn()
  } as any;

  const mockMailer = {
    sendBookingConfirmation: jest.fn(),
    sendPaymentReceived: jest.fn()
  } as any;

  const service = new BookingService(mockPayments, mockMailer);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates booking and payment intent with calculated amount', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'creator-1',
        email: 'creator@snapmatch.app',
        fullName: 'Creator',
        creatorProfile: {
          hourlyRate: 150,
          isAvailable: true
        }
      })
      .mockResolvedValueOnce({
        id: 'customer-1',
        email: 'customer@snapmatch.app'
      });

    (prisma.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'creator-1',
      role: UserRole.CREATOR,
      creatorProfile: { isAvailable: true }
    });

    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.booking.create as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      customerId: 'customer-1',
      creatorId: 'creator-1',
      status: BookingStatus.REQUESTED
    });

    mockPayments.createEscrowPaymentIntent.mockResolvedValue({
      id: 'pi_123',
      status: 'requires_capture'
    });

    const result = await service.create(
      'customer-1',
      {
        creatorId: 'creator-1',
        eventDate: '2026-04-10T00:00:00.000Z',
        startTime: '10:00',
        durationHours: 2,
        location: 'New York',
        paymentMethodId: 'pm_card_visa'
      },
      'idem-key-1'
    );

    expect(mockPayments.createEscrowPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 30000, bookingId: 'booking-1' })
    );
    expect(result.paymentIntentId).toBe('pi_123');
  });
});
