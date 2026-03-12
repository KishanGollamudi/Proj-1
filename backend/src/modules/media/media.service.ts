import crypto from 'crypto';
import { AssetStatus, AssetType, UserRole } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { enqueueMediaAnalysis } from '../../jobs/media-analysis.queue.js';

interface RegisterUploadedAssetInput {
  bookingId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  originalUrl: string;
  transformedUrl?: string;
  metadata?: Record<string, unknown>;
}

function inferAssetTypeFromMime(mimeType: string): AssetType {
  if (mimeType.startsWith('image/')) {
    return AssetType.PHOTO;
  }
  if (mimeType.startsWith('video/')) {
    return AssetType.VIDEO;
  }
  if (mimeType.startsWith('audio/')) {
    return AssetType.AUDIO;
  }
  return AssetType.DOCUMENT;
}

export class MediaService {
  private async assertAssetClean(url: string): Promise<void> {
    if (!env.CLAMAV_SCAN_URL) {
      return;
    }

    const response = await fetch(env.CLAMAV_SCAN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      throw new AppError('Malware scan failed', 502);
    }

    const payload = (await response.json()) as { clean?: boolean; threat?: string };
    if (!payload.clean) {
      throw new AppError(`Uploaded file failed malware scan${payload.threat ? `: ${payload.threat}` : ''}`, 400);
    }
  }

  createCloudinaryUploadSignature(input: { folder: string; fileName: string; mimeType: string }) {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      throw new AppError('Cloudinary environment variables are not configured', 500);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `${input.folder}/${input.fileName}`;
    const paramsToSign = `folder=${input.folder}&public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      timestamp,
      folder: input.folder,
      publicId,
      signature,
      mimeType: input.mimeType
    };
  }

  async registerUploadedAsset(userId: string, input: RegisterUploadedAssetInput) {
    await this.assertAssetClean(input.originalUrl);

    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        customerId: true,
        creatorId: true
      }
    });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    const isParticipant = booking.customerId === userId || booking.creatorId === userId;
    if (!isParticipant && user?.role !== UserRole.ADMIN) {
      throw new AppError('Not authorized to upload media for this booking', 403);
    }

    const asset = await prisma.mediaAsset.create({
      data: {
        bookingId: input.bookingId,
        uploadedById: userId,
        assetType: inferAssetTypeFromMime(input.mimeType),
        status: AssetStatus.PROCESSING,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        originalUrl: input.originalUrl,
        transformedUrl: input.transformedUrl,
        metadata: {
          ...(input.metadata ?? {}),
          ai: {
            state: 'queued',
            queuedAt: new Date().toISOString()
          }
        }
      }
    });

    await enqueueMediaAnalysis({ mediaAssetId: asset.id });

    return asset;
  }
}

export const mediaService = new MediaService();
