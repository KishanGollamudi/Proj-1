import { prisma } from '../../lib/prisma.js';
import { getPineconeIndex } from '../../lib/pinecone.js';
import { searchService } from './search.service.js';

interface CreatorVectorRecord {
  id: string;
  values: number[];
  metadata: {
    fullName: string;
    city?: string;
    country?: string;
    bio?: string;
    hourlyRate?: number;
  };
}

export class PineconeIndexService {
  private readonly pineconeIndex = getPineconeIndex();

  async upsertCreatorEmbeddings(creatorIds?: string[]): Promise<{ upserted: number; skipped: number }> {
    if (!this.pineconeIndex) {
      return { upserted: 0, skipped: 0 };
    }

    const creators = await prisma.user.findMany({
      where: {
        role: 'CREATOR',
        ...(creatorIds?.length ? { id: { in: creatorIds } } : {})
      },
      select: {
        id: true,
        fullName: true,
        creatorProfile: {
          select: {
            city: true,
            country: true,
            bio: true,
            hourlyRate: true
          }
        }
      }
    });

    const vectorRecords: CreatorVectorRecord[] = [];

    for (const creator of creators) {
      const profileText = [
        creator.fullName,
        creator.creatorProfile?.city,
        creator.creatorProfile?.country,
        creator.creatorProfile?.bio,
        creator.creatorProfile?.hourlyRate ? `rate ${creator.creatorProfile.hourlyRate}` : undefined
      ]
        .filter(Boolean)
        .join(' | ');

      if (!profileText.trim()) {
        continue;
      }

      const embedding = await searchService.generateEmbedding(profileText);
      vectorRecords.push({
        id: creator.id,
        values: embedding,
        metadata: {
          fullName: creator.fullName,
          city: creator.creatorProfile?.city ?? undefined,
          country: creator.creatorProfile?.country ?? undefined,
          bio: creator.creatorProfile?.bio ?? undefined,
          hourlyRate: creator.creatorProfile?.hourlyRate ? Number(creator.creatorProfile.hourlyRate) : undefined
        }
      });
    }

    const chunkSize = 50;
    for (let i = 0; i < vectorRecords.length; i += chunkSize) {
      const chunk = vectorRecords.slice(i, i + chunkSize);
      await this.pineconeIndex.namespace('creators').upsert(chunk);
    }

    return {
      upserted: vectorRecords.length,
      skipped: creators.length - vectorRecords.length
    };
  }
}

export const pineconeIndexService = new PineconeIndexService();
