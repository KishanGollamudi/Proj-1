import { createHash } from 'crypto';
import { env } from '../../config/env.js';
import { getPineconeIndex } from '../../lib/pinecone.js';
import { openai } from '../../lib/openai.js';

export interface SearchFilters {
  location?: string;
  specialty?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
}

export interface CreatorScore {
  creatorId: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface RankedCreator {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  creatorProfile?: {
    city?: string | null;
    country?: string | null;
    hourlyRate?: string | number | null;
    ratingAverage?: string | number | null;
    bio?: string | null;
  } | null;
  aiRelevance?: number;
  aiSignals?: {
    vectorScore?: number;
    profileSimilarity?: number;
  };
}

function parseJsonObject<T>(value: string | null | undefined): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function hashEmbedding(text: string, dimensions = 64): number[] {
  const digest = createHash('sha256').update(text.toLowerCase()).digest();
  const vector = Array.from({ length: dimensions }, (_, index) => {
    const source = digest[index % digest.length] ?? 0;
    return (source / 255) * 2 - 1;
  });

  return vector;
}

export class SearchService {
  private readonly pineconeIndex = getPineconeIndex();

  async parseNaturalLanguage(query: string): Promise<SearchFilters> {
    const fallback = this.parseHeuristicFilters(query);

    if (!openai) {
      return fallback;
    }

    try {
      const completion = await openai.chat.completions.create({
        model: env.OPENAI_CHAT_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Extract search filters from user text. Return JSON only with keys: location, specialty, minPrice, maxPrice, minRating. Use null for missing values.'
          },
          {
            role: 'user',
            content: query
          }
        ]
      });

      const payload = parseJsonObject<{
        location?: string | null;
        specialty?: string | null;
        minPrice?: number | null;
        maxPrice?: number | null;
        minRating?: number | null;
      }>(completion.choices[0]?.message?.content);

      if (!payload) {
        return fallback;
      }

      return {
        location: payload.location ?? fallback.location,
        specialty: payload.specialty ?? fallback.specialty,
        minPrice: payload.minPrice ?? fallback.minPrice,
        maxPrice: payload.maxPrice ?? fallback.maxPrice,
        minRating: payload.minRating ?? fallback.minRating
      };
    } catch {
      return fallback;
    }
  }

  private parseHeuristicFilters(query: string): SearchFilters {
    const normalized = query.trim();
    if (!normalized) {
      return {};
    }

    const lower = normalized.toLowerCase();
    const budgetUnder = lower.match(/under\s*\$?(\d{2,5})/i);
    const budgetOver = lower.match(/over\s*\$?(\d{2,5})/i);
    const ratingMatch = lower.match(/(\d(?:\.\d)?)\s*\+?\s*(?:stars?|rating)/i);
    const inLocation = normalized.match(/\b(?:in|at|near)\s+([a-zA-Z\s]{2,40})$/i);

    const specialties = ['wedding', 'portrait', 'event', 'fashion', 'product', 'newborn', 'travel', 'sports', 'candid'];
    const specialty = specialties.find((item) => lower.includes(item));

    return {
      location: inLocation?.[1]?.trim(),
      specialty,
      minPrice: budgetOver ? Number(budgetOver[1]) : undefined,
      maxPrice: budgetUnder ? Number(budgetUnder[1]) : undefined,
      minRating: ratingMatch ? Number(ratingMatch[1]) : undefined
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!openai) {
      return hashEmbedding(text);
    }

    try {
      const response = await openai.embeddings.create({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: text
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding?.length) {
        return hashEmbedding(text);
      }
      return embedding;
    } catch {
      return hashEmbedding(text);
    }
  }

  async vectorSearch(embedding: number[], topK: number): Promise<CreatorScore[]> {
    if (!this.pineconeIndex) {
      return [];
    }

    try {
      const response = await this.pineconeIndex.namespace('creators').query({
        vector: embedding,
        topK,
        includeMetadata: true
      });

      return (response.matches ?? [])
        .filter((match) => typeof match.id === 'string')
        .map((match) => ({
          creatorId: String(match.id),
          score: Number(match.score ?? 0),
          metadata: (match.metadata ?? {}) as Record<string, unknown>
        }));
    } catch {
      return [];
    }
  }

  async rankCreators(
    creators: RankedCreator[],
    queryEmbedding: number[],
    userContext?: {
      vectorScores?: CreatorScore[];
      textQuery?: string;
    }
  ): Promise<RankedCreator[]> {
    const vectorScoreMap = new Map((userContext?.vectorScores ?? []).map((item) => [item.creatorId, item.score]));

    return [...creators]
      .map((creator) => {
        const vectorScore = vectorScoreMap.get(creator.id) ?? 0;
        const profileText = [
          creator.fullName,
          creator.creatorProfile?.bio,
          creator.creatorProfile?.city,
          creator.creatorProfile?.country
        ]
          .filter(Boolean)
          .join(' ');

        const profileEmbedding = hashEmbedding(profileText, queryEmbedding.length || 64);
        const profileSimilarity = cosineSimilarity(queryEmbedding, profileEmbedding);

        const rating = Number(creator.creatorProfile?.ratingAverage ?? 0);
        const normalizedRating = clamp(rating / 5, 0, 1);
        const aiRelevance = clamp(vectorScore * 0.55 + profileSimilarity * 0.3 + normalizedRating * 0.15, 0, 1);

        return {
          ...creator,
          aiRelevance,
          aiSignals: {
            vectorScore,
            profileSimilarity
          }
        };
      })
      .sort((a, b) => (b.aiRelevance ?? 0) - (a.aiRelevance ?? 0));
  }
}

export const searchService = new SearchService();
