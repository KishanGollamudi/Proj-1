import { TransactionStatus, TransactionType } from '@prisma/client';
import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/app-error.js';

export class PaymentService {
  public readonly stripe: Stripe;

  constructor(stripeClient?: Stripe) {
    this.stripe =
      stripeClient ??
      new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-02-24.acacia'
      });
  }

  async createConnectedAccountForCreator(userId: string, email: string): Promise<{ accountId: string; onboardingUrl: string }> {
    const account = await this.stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      }
    });

    const accountLink = await this.stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${env.APP_URL}/creator/onboarding/refresh`,
      return_url: `${env.APP_URL}/creator/onboarding/complete`,
      type: 'account_onboarding'
    });

    return {
      accountId: account.id,
      onboardingUrl: accountLink.url
    };
  }

  async createEscrowPaymentIntent(params: {
    bookingId: string;
    customerId: string;
    amount: number;
    currency: string;
    paymentMethodId: string;
    idempotencyKey: string;
  }): Promise<Stripe.PaymentIntent> {
    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: params.amount,
        currency: params.currency,
        payment_method: params.paymentMethodId,
        confirmation_method: 'automatic',
        confirm: true,
        capture_method: 'manual',
        metadata: {
          bookingId: params.bookingId,
          customerId: params.customerId
        }
      },
      { idempotencyKey: params.idempotencyKey }
    );

    await prisma.transaction.create({
      data: {
        bookingId: params.bookingId,
        payerId: params.customerId,
        type: TransactionType.BOOKING_PAYMENT,
        status:
          paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture'
            ? TransactionStatus.SUCCEEDED
            : TransactionStatus.REQUIRES_ACTION,
        amount: (params.amount / 100).toFixed(2),
        currency: params.currency.toUpperCase(),
        stripePaymentIntentId: paymentIntent.id,
        metadata: {
          stripeStatus: paymentIntent.status
        }
      }
    });

    return paymentIntent;
  }

  async createEditorTaskEscrow(params: {
    editorTaskId: string;
    customerId: string;
    amount: number;
    currency: string;
    paymentMethodId: string;
    idempotencyKey: string;
  }): Promise<Stripe.PaymentIntent> {
    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: params.amount,
        currency: params.currency,
        payment_method: params.paymentMethodId,
        confirmation_method: 'automatic',
        confirm: true,
        capture_method: 'manual',
        metadata: {
          editorTaskId: params.editorTaskId,
          customerId: params.customerId,
          paymentKind: 'editor_task_escrow'
        }
      },
      { idempotencyKey: params.idempotencyKey }
    );

    await prisma.transaction.create({
      data: {
        payerId: params.customerId,
        type: TransactionType.BOOKING_PAYMENT,
        status:
          paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture'
            ? TransactionStatus.SUCCEEDED
            : TransactionStatus.REQUIRES_ACTION,
        amount: (params.amount / 100).toFixed(2),
        currency: params.currency.toUpperCase(),
        stripePaymentIntentId: paymentIntent.id,
        metadata: {
          paymentKind: 'editor_task_escrow',
          editorTaskId: params.editorTaskId,
          stripeStatus: paymentIntent.status
        }
      }
    });

    return paymentIntent;
  }

  async releaseEditorTaskPayment(params: {
    editorTaskId: string;
    editorId: string;
    amount: number;
    currency: string;
  }): Promise<void> {
    const escrow = await prisma.transaction.findFirst({
      where: {
        type: TransactionType.BOOKING_PAYMENT,
        stripePaymentIntentId: { not: null },
        metadata: {
          path: ['editorTaskId'],
          equals: params.editorTaskId
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!escrow?.stripePaymentIntentId) {
      throw new AppError('Escrow transaction not found for editor task', 404);
    }

    const intent = await this.stripe.paymentIntents.capture(escrow.stripePaymentIntentId);

    let stripeTransferId: string | null = null;
    const editor = await prisma.user.findUnique({
      where: { id: params.editorId },
      select: {
        editorProfile: {
          select: { stripeAccountId: true }
        }
      }
    });

    const destination = editor?.editorProfile?.stripeAccountId;
    const sourceChargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : null;

    if (destination && sourceChargeId) {
      try {
        const transfer = await this.stripe.transfers.create({
          amount: params.amount,
          currency: params.currency.toLowerCase(),
          destination,
          source_transaction: sourceChargeId,
          metadata: {
            editorTaskId: params.editorTaskId,
            editorId: params.editorId
          }
        });
        stripeTransferId = transfer.id;
      } catch (error) {
        logger.error('Editor transfer creation failed', {
          editorTaskId: params.editorTaskId,
          editorId: params.editorId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    await prisma.transaction.create({
      data: {
        payerId: escrow.payerId,
        payeeId: params.editorId,
        type: TransactionType.EDITOR_PAYOUT,
        status: TransactionStatus.SUCCEEDED,
        amount: (params.amount / 100).toFixed(2),
        currency: params.currency.toUpperCase(),
        stripePaymentIntentId: intent.id,
        stripeTransferId,
        metadata: {
          editorTaskId: params.editorTaskId,
          paymentKind: 'editor_task_payout'
        },
        processedAt: new Date()
      }
    });
  }

  async captureEscrow(bookingId: string): Promise<void> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        bookingId,
        type: TransactionType.BOOKING_PAYMENT,
        stripePaymentIntentId: { not: null }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!transaction?.stripePaymentIntentId) {
      throw new AppError('No payment intent found for booking', 404);
    }

    await this.stripe.paymentIntents.capture(transaction.stripePaymentIntentId);

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: TransactionStatus.SUCCEEDED }
    });
  }

  async refundBooking(bookingId: string, reason?: string, refundPercent?: number): Promise<void> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        bookingId,
        type: TransactionType.BOOKING_PAYMENT,
        stripePaymentIntentId: { not: null }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!transaction?.stripePaymentIntentId) {
      throw new AppError('No payment intent found for booking', 404);
    }

    let amountCents: number | undefined;
    if (refundPercent && refundPercent > 0 && refundPercent < 100) {
      const amount = Number(transaction.amount);
      amountCents = Math.round(amount * 100 * (refundPercent / 100));
    }

    await this.stripe.refunds.create({
      payment_intent: transaction.stripePaymentIntentId,
      amount: amountCents,
      reason: reason ? 'requested_by_customer' : undefined,
      metadata: { bookingId, reason: reason ?? 'n/a', refundPercent: refundPercent ? String(refundPercent) : '100' }
    });

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: TransactionStatus.REFUNDED }
    });
  }

  async handleWebhookEvent(payload: Buffer, signature?: string): Promise<void> {
    let event: Stripe.Event;

    if (env.STRIPE_WEBHOOK_SECRET && signature) {
      event = this.stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(payload.toString()) as Stripe.Event;
    }

    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.canceled') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const bookingId = paymentIntent.metadata?.bookingId;

      if (!bookingId) {
        return;
      }

      await prisma.booking.updateMany({
        where: { id: bookingId },
        data: {
          status: event.type === 'payment_intent.succeeded' ? 'CONFIRMED' : 'CANCELED'
        }
      });

      await prisma.transaction.updateMany({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: {
          status: event.type === 'payment_intent.succeeded' ? TransactionStatus.SUCCEEDED : TransactionStatus.CANCELED
        }
      });
    }
  }
}

export const paymentService = new PaymentService();
