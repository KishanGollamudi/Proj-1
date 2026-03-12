import { SubscriptionPlan, SubscriptionStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { paymentService, PaymentService } from '../payments/payment.service.js';

export interface PlanDefinition {
  code: Exclude<SubscriptionPlan, 'FREE'>;
  name: string;
  monthlyPriceUsd: number;
  includedHours: number;
  fairUseLimitHours: number | null;
  stripePriceId?: string;
}

const PLANS: PlanDefinition[] = [
  {
    code: 'BASIC',
    name: 'Basic',
    monthlyPriceUsd: 29,
    includedHours: 1,
    fairUseLimitHours: null,
    stripePriceId: env.STRIPE_PRICE_BASIC
  },
  {
    code: 'PRO',
    name: 'Pro',
    monthlyPriceUsd: 99,
    includedHours: 4,
    fairUseLimitHours: null,
    stripePriceId: env.STRIPE_PRICE_PRO
  },
  {
    code: 'UNLIMITED',
    name: 'Unlimited',
    monthlyPriceUsd: 299,
    includedHours: 999,
    fairUseLimitHours: 40,
    stripePriceId: env.STRIPE_PRICE_UNLIMITED
  }
];

function getPlan(plan: Exclude<SubscriptionPlan, 'FREE'>): PlanDefinition {
  const found = PLANS.find((item) => item.code === plan);
  if (!found) {
    throw new AppError('Unsupported plan', 400);
  }
  return found;
}

export class SubscriptionService {
  constructor(private readonly payments: PaymentService = paymentService) {}

  listPlans() {
    return PLANS;
  }

  async mySubscription(userId: string) {
    return prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async subscribe(userId: string, email: string, input: { plan: Exclude<SubscriptionPlan, 'FREE'>; paymentMethodId?: string }) {
    const plan = getPlan(input.plan);

    const current = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (current) {
      throw new AppError('Active subscription already exists. Cancel first or wait for period end.', 409);
    }

    let stripeCustomerId: string | null = null;
    let stripeSubscriptionId: string | null = null;

    if (plan.stripePriceId && input.paymentMethodId) {
      const customer = await this.payments.stripe.customers.create({
        email,
        payment_method: input.paymentMethodId,
        invoice_settings: {
          default_payment_method: input.paymentMethodId
        },
        metadata: { userId }
      });
      stripeCustomerId = customer.id;

      const stripeSub = await this.payments.stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: plan.stripePriceId }],
        metadata: { userId, plan: input.plan }
      });
      stripeSubscriptionId = stripeSub.id;
    }

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        plan: input.plan,
        status: SubscriptionStatus.ACTIVE,
        startAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stripeCustomerId: stripeCustomerId ?? undefined,
        stripeSubscriptionId: stripeSubscriptionId ?? undefined,
        stripePriceId: plan.stripePriceId,
        includedHours: plan.includedHours.toFixed(2),
        usedHours: '0.00',
        bonusHours: '0.00',
        fairUseLimitHours: plan.fairUseLimitHours?.toFixed(2)
      }
    });

    await prisma.transaction.create({
      data: {
        subscriptionId: subscription.id,
        payerId: userId,
        type: TransactionType.SUBSCRIPTION_CHARGE,
        status: TransactionStatus.SUCCEEDED,
        amount: plan.monthlyPriceUsd.toFixed(2),
        currency: 'USD',
        metadata: {
          plan: input.plan,
          source: stripeSubscriptionId ? 'stripe' : 'manual-sandbox'
        }
      }
    });

    return subscription;
  }

  async cancelAtPeriodEnd(userId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      throw new AppError('No active subscription found', 404);
    }

    if (subscription.stripeSubscriptionId) {
      await this.payments.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
    }

    return prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true
      }
    });
  }

  async topUpHours(userId: string, input: { hours: number; paymentMethodId: string }) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      throw new AppError('Active subscription required for top-up', 404);
    }

    const amountCents = Math.round(input.hours * 25 * 100);
    await this.payments.stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      payment_method: input.paymentMethodId,
      confirm: true,
      confirmation_method: 'automatic',
      metadata: {
        userId,
        subscriptionId: subscription.id,
        topupHours: String(input.hours)
      }
    });

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        bonusHours: (Number(subscription.bonusHours) + input.hours).toFixed(2)
      }
    });

    await prisma.transaction.create({
      data: {
        subscriptionId: subscription.id,
        payerId: userId,
        type: TransactionType.SUBSCRIPTION_CHARGE,
        status: TransactionStatus.SUCCEEDED,
        amount: (amountCents / 100).toFixed(2),
        currency: 'USD',
        metadata: {
          source: 'topup',
          hours: input.hours
        }
      }
    });

    return updated;
  }

  async handleWebhook(payload: Buffer, signature?: string) {
    let event;

    if (env.STRIPE_WEBHOOK_SECRET && signature) {
      event = this.payments.stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(payload.toString());
    }

    if (event.type.startsWith('customer.subscription.')) {
      const sub = event.data.object as {
        id: string;
        status: string;
        current_period_end?: number;
        cancel_at_period_end?: boolean;
      };

      const mappedStatus =
        sub.status === 'active'
          ? SubscriptionStatus.ACTIVE
          : sub.status === 'trialing'
            ? SubscriptionStatus.TRIALING
            : sub.status === 'past_due'
              ? SubscriptionStatus.PAST_DUE
              : sub.status === 'canceled'
                ? SubscriptionStatus.CANCELED
                : SubscriptionStatus.INCOMPLETE;

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          status: mappedStatus,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          canceledAt: mappedStatus === SubscriptionStatus.CANCELED ? new Date() : undefined
        }
      });
    }

    return { received: true };
  }
}

export const subscriptionService = new SubscriptionService();
