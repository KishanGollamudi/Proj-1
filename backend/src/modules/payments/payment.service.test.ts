import { prisma } from '../../lib/prisma.js';
import { PaymentService } from './payment.service.js';

jest.mock('../../lib/prisma.js', () => ({
  prisma: {
    booking: {
      updateMany: jest.fn()
    },
    transaction: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    user: {
      update: jest.fn()
    }
  }
}));

describe('PaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles payment_intent.succeeded webhook and updates booking/transaction', async () => {
    const stripeMock = {
      webhooks: {
        constructEvent: jest.fn()
      }
    } as any;

    const service = new PaymentService(stripeMock);

    const event = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          metadata: {
            bookingId: 'booking-1'
          }
        }
      }
    };

    await service.handleWebhookEvent(Buffer.from(JSON.stringify(event)));

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'booking-1' }, data: { status: 'CONFIRMED' } })
    );
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripePaymentIntentId: 'pi_123' } })
    );
  });
});
