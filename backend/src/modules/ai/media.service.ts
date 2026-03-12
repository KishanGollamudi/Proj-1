import { createHash } from 'crypto';
import { env } from '../../config/env.js';
import { openai } from '../../lib/openai.js';

export interface ImageTags {
  tags: string[];
  quality?: {
    blurry?: boolean;
    overexposed?: boolean;
    notes?: string;
  };
}

export interface FaceGroup {
  groupId: string;
  imageUrls: string[];
}

function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function fallbackTagsFromUrl(imageUrl: string): ImageTags {
  const decoded = decodeURIComponent(imageUrl).toLowerCase();
  const seedTags = ['event'];

  const knownTags = ['wedding', 'bride', 'groom', 'cake', 'portrait', 'candid', 'fashion', 'product', 'outdoor', 'night'];
  for (const tag of knownTags) {
    if (decoded.includes(tag)) {
      seedTags.push(tag);
    }
  }

  return {
    tags: Array.from(new Set(seedTags)).slice(0, 10),
    quality: {
      notes: 'Fallback heuristic tags used.'
    }
  };
}

export class MediaAiService {
  async analyzeImage(imageUrl: string): Promise<ImageTags> {
    if (!openai) {
      return fallbackTagsFromUrl(imageUrl);
    }

    try {
      const response = await openai.chat.completions.create({
        model: env.OPENAI_CHAT_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You analyze event photos. Return JSON only with {"tags": string[], "quality": {"blurry": boolean, "overexposed": boolean, "notes": string}}.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Generate concise tags and quality indicators.' },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ]
      });

      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as ImageTags;
      return {
        tags: Array.isArray(parsed.tags) ? parsed.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 20) : [],
        quality: parsed.quality
      };
    } catch {
      return fallbackTagsFromUrl(imageUrl);
    }
  }

  async groupByFaces(imageUrls: string[]): Promise<FaceGroup[]> {
    if (imageUrls.length === 0) {
      return [];
    }

    // Fallback deterministic grouping. Replace with Rekognition/local model when available.
    const bucket = new Map<string, string[]>();
    for (const imageUrl of imageUrls) {
      const hash = createHash('sha1').update(imageUrl).digest('hex');
      const groupId = `group-${hash.slice(0, 2)}`;
      const current = bucket.get(groupId) ?? [];
      current.push(imageUrl);
      bucket.set(groupId, current);
    }

    return Array.from(bucket.entries())
      .map(([groupId, urls]) => ({
        groupId: toSlug(groupId),
        imageUrls: urls
      }))
      .filter((group) => group.imageUrls.length > 0);
  }
}

export const mediaAiService = new MediaAiService();
