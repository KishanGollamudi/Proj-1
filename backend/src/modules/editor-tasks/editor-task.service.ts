import { TaskStatus, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { enqueueEditorTaskNotification } from '../../jobs/editor-task-notification.queue.js';
import { emitEditorTaskUpdate } from '../../lib/realtime.js';
import { editorMatchingService } from '../ai/editor-matching.service.js';
import { paymentService, PaymentService } from '../payments/payment.service.js';

interface CreateEditorTaskInput {
  bookingId?: string;
  mediaAssetIds: string[];
  stylePreference: string;
  description: string;
  requiredSpecialty?: string;
  requiredSoftware?: string;
  dueDays?: number;
  paymentMethodId: string;
}

interface ListEditorTaskFilters {
  status?: 'pending' | 'assigned' | 'submitted' | 'changes_requested' | 'completed' | 'canceled';
  bookingId?: string;
  page: number;
  limit: number;
}

const STATUS_FROM_PUBLIC: Record<NonNullable<ListEditorTaskFilters['status']>, TaskStatus> = {
  pending: TaskStatus.TODO,
  assigned: TaskStatus.IN_PROGRESS,
  submitted: TaskStatus.REVIEW,
  changes_requested: TaskStatus.CHANGES_REQUESTED,
  completed: TaskStatus.COMPLETED,
  canceled: TaskStatus.CANCELED
};

function toPublicStatus(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.TODO:
      return 'pending';
    case TaskStatus.IN_PROGRESS:
      return 'assigned';
    case TaskStatus.REVIEW:
      return 'submitted';
    case TaskStatus.CHANGES_REQUESTED:
      return 'changes_requested';
    case TaskStatus.COMPLETED:
      return 'completed';
    case TaskStatus.CANCELED:
      return 'canceled';
    default:
      return 'pending';
  }
}

function calculateComplexity(input: CreateEditorTaskInput): number {
  const assetWeight = Math.ceil(input.mediaAssetIds.length / 10);
  const descriptionWeight = input.description.length > 700 ? 2 : input.description.length > 300 ? 1 : 0;
  const styleWeight = /cinematic|retouch|color|vfx|composite|advanced/i.test(input.stylePreference) ? 1 : 0;
  return Math.min(5, Math.max(1, assetWeight + descriptionWeight + styleWeight));
}

function complexityMultiplier(complexity: number): number {
  if (complexity >= 5) {
    return 2;
  }
  if (complexity >= 3) {
    return 1.5;
  }
  return 1;
}

export class EditorTaskService {
  constructor(private readonly payments: PaymentService = paymentService) {}

  private async assertCustomerCanUseBooking(customerId: string, bookingId?: string): Promise<void> {
    if (!bookingId) {
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, customerId: true }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (booking.customerId !== customerId) {
      throw new AppError('You can only create tasks for your own bookings', 403);
    }
  }

  async create(customerId: string, input: CreateEditorTaskInput, idempotencyKey: string) {
    await this.assertCustomerCanUseBooking(customerId, input.bookingId);

    const mediaAssets = await prisma.mediaAsset.findMany({
      where: {
        id: { in: input.mediaAssetIds }
      },
      select: {
        id: true,
        bookingId: true
      }
    });

    if (mediaAssets.length !== input.mediaAssetIds.length) {
      throw new AppError('One or more media assets were not found', 400);
    }

    if (input.bookingId && mediaAssets.some((asset) => asset.bookingId !== input.bookingId)) {
      throw new AppError('All media assets must belong to the selected booking', 400);
    }

    const complexity = calculateComplexity(input);

    const suggestions = await editorMatchingService.suggestEditors({
      requiredSpecialty: input.requiredSpecialty,
      requiredSoftware: input.requiredSoftware,
      complexityScore: complexity
    });

    const baselineRate = suggestions[0]?.hourlyRate ?? 50;
    const estimatedPrice = baselineRate * complexityMultiplier(complexity);

    const dueAt = input.dueDays ? new Date(Date.now() + input.dueDays * 24 * 60 * 60 * 1000) : null;

    const createdTask = await prisma.editorTask.create({
      data: {
        bookingId: input.bookingId,
        customerId,
        mediaAssetId: input.mediaAssetIds[0] ?? null,
        mediaAssetIds: input.mediaAssetIds,
        stylePreference: input.stylePreference,
        description: input.description,
        requiredSpecialty: input.requiredSpecialty,
        requiredSoftware: input.requiredSoftware,
        status: TaskStatus.TODO,
        complexityScore: complexity,
        estimatedPrice: estimatedPrice.toFixed(2),
        dueAt
      },
      include: {
        customer: {
          select: { id: true, fullName: true, email: true }
        },
        editor: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });

    try {
      await this.payments.createEditorTaskEscrow({
        editorTaskId: createdTask.id,
        customerId,
        amount: Math.round(estimatedPrice * 100),
        currency: 'usd',
        paymentMethodId: input.paymentMethodId,
        idempotencyKey
      });
    } catch (error) {
      await prisma.editorTask.delete({ where: { id: createdTask.id } });
      throw error;
    }

    await enqueueEditorTaskNotification({
      event: 'task_created',
      editorTaskId: createdTask.id,
      customerId
    });

    emitEditorTaskUpdate({
      taskId: createdTask.id,
      event: 'created',
      customerId,
      editorId: createdTask.editorId,
      statusLabel: toPublicStatus(createdTask.status)
    });

    return {
      ...createdTask,
      statusLabel: toPublicStatus(createdTask.status),
      suggestedEditors: suggestions
    };
  }

  async listForUser(userId: string, role: UserRole, filters: ListEditorTaskFilters) {
    const statusFilter = filters.status ? STATUS_FROM_PUBLIC[filters.status] : undefined;

    let where;
    if (role === UserRole.CUSTOMER) {
      where = {
        customerId: userId,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(filters.bookingId ? { bookingId: filters.bookingId } : {})
      };
    } else if (role === UserRole.EDITOR) {
      where = {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(filters.bookingId ? { bookingId: filters.bookingId } : {}),
        OR: [{ editorId: userId }, { status: TaskStatus.TODO }]
      };
    } else if (role === UserRole.ADMIN) {
      where = {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(filters.bookingId ? { bookingId: filters.bookingId } : {})
      };
    } else {
      throw new AppError('Only customers, editors, and admins can list editor tasks', 403);
    }

    const tasks = await prisma.editorTask.findMany({
      where,
      include: {
        customer: { select: { id: true, fullName: true } },
        editor: { select: { id: true, fullName: true } },
        booking: { select: { id: true, title: true, eventDate: true } }
      },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      orderBy: { createdAt: 'desc' }
    });

    return tasks.map((task) => ({
      ...task,
      statusLabel: toPublicStatus(task.status)
    }));
  }

  async getById(userId: string, role: UserRole, taskId: string) {
    const task = await prisma.editorTask.findUnique({
      where: { id: taskId },
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
        editor: { select: { id: true, fullName: true, email: true } },
        booking: { select: { id: true, title: true, eventDate: true } }
      }
    });

    if (!task) {
      throw new AppError('Editor task not found', 404);
    }

    const canAccess =
      role === UserRole.ADMIN ||
      task.customerId === userId ||
      task.editorId === userId ||
      (role === UserRole.EDITOR && task.status === TaskStatus.TODO);

    if (!canAccess) {
      throw new AppError('You are not allowed to access this task', 403);
    }

    return {
      ...task,
      statusLabel: toPublicStatus(task.status)
    };
  }

  async assign(taskId: string, editorId: string) {
    const editor = await prisma.user.findUnique({
      where: { id: editorId },
      select: {
        role: true,
        editorProfile: {
          select: { isAvailable: true }
        }
      }
    });

    if (editor?.role !== UserRole.EDITOR || !editor.editorProfile?.isAvailable) {
      throw new AppError('Editor profile is unavailable for assignment', 409);
    }

    const task = await prisma.editorTask.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new AppError('Editor task not found', 404);
    }

    if (task.status !== TaskStatus.TODO && task.status !== TaskStatus.CHANGES_REQUESTED) {
      throw new AppError('Task is not open for assignment', 409);
    }

    if (task.editorId && task.editorId !== editorId) {
      throw new AppError('Task is already assigned to another editor', 409);
    }

    const updated = await prisma.editorTask.update({
      where: { id: taskId },
      data: {
        editorId,
        status: TaskStatus.IN_PROGRESS
      },
      include: {
        customer: { select: { id: true, fullName: true } },
        editor: { select: { id: true, fullName: true } }
      }
    });

    await enqueueEditorTaskNotification({
      event: 'task_assigned',
      editorTaskId: taskId,
      customerId: updated.customerId,
      editorId
    });

    emitEditorTaskUpdate({
      taskId,
      event: 'assigned',
      customerId: updated.customerId,
      editorId,
      statusLabel: toPublicStatus(updated.status)
    });

    return {
      ...updated,
      statusLabel: toPublicStatus(updated.status)
    };
  }

  async submit(taskId: string, editorId: string, input: { submittedMediaUrls: string[]; notes?: string }) {
    const task = await prisma.editorTask.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new AppError('Editor task not found', 404);
    }

    if (task.editorId !== editorId) {
      throw new AppError('Only the assigned editor can submit work', 403);
    }

    if (task.status !== TaskStatus.IN_PROGRESS && task.status !== TaskStatus.CHANGES_REQUESTED) {
      throw new AppError('Task is not in a submittable state', 409);
    }

    const updated = await prisma.editorTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.REVIEW,
        submittedMediaUrls: input.submittedMediaUrls,
        description: input.notes ? `${task.description ?? ''}\n\nSubmission notes: ${input.notes}`.trim() : task.description
      }
    });

    await enqueueEditorTaskNotification({
      event: 'task_submitted',
      editorTaskId: taskId,
      customerId: task.customerId,
      editorId
    });

    emitEditorTaskUpdate({
      taskId,
      event: 'submitted',
      customerId: task.customerId,
      editorId,
      statusLabel: toPublicStatus(updated.status)
    });

    return {
      ...updated,
      statusLabel: toPublicStatus(updated.status)
    };
  }

  async approve(taskId: string, customerId: string) {
    const task = await prisma.editorTask.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new AppError('Editor task not found', 404);
    }

    if (task.customerId !== customerId) {
      throw new AppError('Only the task customer can approve', 403);
    }

    if (!task.editorId) {
      throw new AppError('Task is not assigned to an editor', 409);
    }

    if (task.status !== TaskStatus.REVIEW) {
      throw new AppError('Only submitted tasks can be approved', 409);
    }

    const amountCents = Math.round(Number(task.estimatedPrice) * 100);
    await this.payments.releaseEditorTaskPayment({
      editorTaskId: task.id,
      editorId: task.editorId,
      amount: amountCents,
      currency: 'usd'
    });

    const updated = await prisma.editorTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.COMPLETED,
        approvedAt: new Date(),
        completedAt: new Date()
      }
    });

    await enqueueEditorTaskNotification({
      event: 'task_approved',
      editorTaskId: taskId,
      customerId,
      editorId: task.editorId
    });

    emitEditorTaskUpdate({
      taskId,
      event: 'approved',
      customerId,
      editorId: task.editorId,
      statusLabel: toPublicStatus(updated.status)
    });

    return {
      ...updated,
      statusLabel: toPublicStatus(updated.status)
    };
  }

  async reject(taskId: string, customerId: string, revisionNotes: string) {
    const task = await prisma.editorTask.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new AppError('Editor task not found', 404);
    }

    if (task.customerId !== customerId) {
      throw new AppError('Only the task customer can reject submission', 403);
    }

    if (task.status !== TaskStatus.REVIEW) {
      throw new AppError('Only submitted tasks can be rejected', 409);
    }

    const updated = await prisma.editorTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.CHANGES_REQUESTED,
        revisionNotes,
        rejectedAt: new Date()
      }
    });

    await enqueueEditorTaskNotification({
      event: 'task_rejected',
      editorTaskId: taskId,
      customerId,
      editorId: task.editorId
    });

    emitEditorTaskUpdate({
      taskId,
      event: 'rejected',
      customerId,
      editorId: task.editorId,
      statusLabel: toPublicStatus(updated.status)
    });

    return {
      ...updated,
      statusLabel: toPublicStatus(updated.status)
    };
  }
}

export const editorTaskService = new EditorTaskService();
