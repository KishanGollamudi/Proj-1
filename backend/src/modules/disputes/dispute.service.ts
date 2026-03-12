import { DisputeStatus, UserRole } from '@prisma/client';
import { env } from '../../config/env.js';
import { openai } from '../../lib/openai.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { paymentService, PaymentService } from '../payments/payment.service.js';

function fallbackSuggestion(reason: string) {
  const lower = reason.toLowerCase();
  if (lower.includes('no-show')) {
    return { summary: 'Potential no-show dispute', resolution: 'Recommend high refund and warning review.', refundPct: 80 };
  }
  if (lower.includes('quality') || lower.includes('unhappy')) {
    return { summary: 'Quality-related dissatisfaction', resolution: 'Recommend partial refund after review.', refundPct: 40 };
  }
  return { summary: 'General dispute filed', resolution: 'Recommend manual review with moderate refund option.', refundPct: 25 };
}

export class DisputeService {
  constructor(private readonly payments: PaymentService = paymentService) {}

  async fileDispute(userId: string, input: { bookingId: string; reason: string; details?: string }) {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        customerId: true,
        creatorId: true,
        status: true,
        title: true,
        description: true,
        eventDate: true,
        location: true,
        transactions: {
          select: { amount: true, status: true, type: true },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        mediaAssets: {
          select: { id: true, fileName: true, status: true },
          take: 20
        }
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (booking.customerId !== userId && booking.creatorId !== userId) {
      throw new AppError('Only booking participants can file disputes', 403);
    }

    const recentMessages = await prisma.message.findMany({
      where: { bookingId: booking.id },
      select: { senderId: true, content: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    let aiSummary = '';
    let aiSuggestedResolution = '';
    let suggestedRefundPct = 0;

    const fallback = fallbackSuggestion(input.reason);
    aiSummary = fallback.summary;
    aiSuggestedResolution = fallback.resolution;
    suggestedRefundPct = fallback.refundPct;

    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: env.OPENAI_CHAT_MODEL,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are a dispute triage assistant. Return JSON with keys summary, suggestedResolution, suggestedRefundPct (0-100).'
            },
            {
              role: 'user',
              content: JSON.stringify({
                reason: input.reason,
                details: input.details,
                booking,
                recentMessages
              })
            }
          ]
        });

        const raw = completion.choices[0]?.message?.content;
        if (raw) {
          const parsed = JSON.parse(raw) as {
            summary?: string;
            suggestedResolution?: string;
            suggestedRefundPct?: number;
          };
          aiSummary = parsed.summary ?? aiSummary;
          aiSuggestedResolution = parsed.suggestedResolution ?? aiSuggestedResolution;
          suggestedRefundPct = Math.max(0, Math.min(100, Number(parsed.suggestedRefundPct ?? suggestedRefundPct)));
        }
      } catch {
        // keep fallback
      }
    }

    return prisma.dispute.create({
      data: {
        bookingId: input.bookingId,
        filedById: userId,
        reason: input.reason,
        details: input.details,
        status: DisputeStatus.OPEN,
        aiSummary,
        aiSuggestedResolution,
        suggestedRefundPct: suggestedRefundPct.toFixed(2)
      }
    });
  }

  async listForAdmin() {
    return prisma.dispute.findMany({
      include: {
        booking: {
          select: {
            id: true,
            title: true,
            status: true,
            customer: { select: { id: true, fullName: true, email: true } },
            creator: { select: { id: true, fullName: true, email: true } }
          }
        },
        filedBy: { select: { id: true, fullName: true, email: true } },
        resolvedBy: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async resolve(disputeId: string, adminId: string, input: { resolutionNotes: string; refundPercent?: number }) {
    const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true } });
    if (admin?.role !== UserRole.ADMIN) {
      throw new AppError('Only admin can resolve disputes', 403);
    }

    const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) {
      throw new AppError('Dispute not found', 404);
    }

    if (dispute.status === DisputeStatus.RESOLVED) {
      throw new AppError('Dispute already resolved', 409);
    }

    if (input.refundPercent && input.refundPercent > 0) {
      await this.payments.refundBooking(dispute.bookingId, 'Dispute resolution', input.refundPercent);
    }

    return prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.RESOLVED,
        resolvedById: adminId,
        resolutionNotes: input.resolutionNotes,
        resolvedAt: new Date()
      }
    });
  }
}

export const disputeService = new DisputeService();
