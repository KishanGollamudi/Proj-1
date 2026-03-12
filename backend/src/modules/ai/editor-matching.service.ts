import { prisma } from '../../lib/prisma.js';

interface MatchInput {
  requiredSpecialty?: string;
  requiredSoftware?: string;
  maxHourlyRate?: number;
  complexityScore: number;
}

export interface SuggestedEditor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  score: number;
  reasons: string[];
  hourlyRate: number;
}

function normalize(value: number, max = 100): number {
  return Math.max(0, Math.min(1, value / max));
}

export class EditorMatchingService {
  async suggestEditors(input: MatchInput, topK = 5): Promise<SuggestedEditor[]> {
    const editors = await prisma.user.findMany({
      where: {
        role: 'EDITOR',
        editorProfile: {
          is: {
            isAvailable: true,
            ...(input.maxHourlyRate
              ? {
                  hourlyRate: {
                    lte: input.maxHourlyRate.toFixed(2)
                  }
                }
              : {})
          }
        }
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        editorProfile: {
          select: {
            specialties: true,
            tools: true,
            hourlyRate: true,
            ratingAverage: true,
            turnaroundHours: true
          }
        }
      },
      take: 100
    });

    const ranked = editors
      .map((editor) => {
        const profile = editor.editorProfile;
        if (!profile?.hourlyRate) {
          return null;
        }

        const hourlyRate = Number(profile.hourlyRate);
        const rating = Number(profile.ratingAverage ?? 0);
        const reasons: string[] = [];

        const specialtyMatch = input.requiredSpecialty
          ? profile.specialties.some((item) => item.toLowerCase() === input.requiredSpecialty!.toLowerCase())
          : true;
        if (specialtyMatch && input.requiredSpecialty) {
          reasons.push(`specialty:${input.requiredSpecialty}`);
        }

        const softwareMatch = input.requiredSoftware
          ? profile.tools.some((item) => item.toLowerCase() === input.requiredSoftware!.toLowerCase())
          : true;
        if (softwareMatch && input.requiredSoftware) {
          reasons.push(`software:${input.requiredSoftware}`);
        }

        const affordability = input.maxHourlyRate ? Math.max(0, 1 - hourlyRate / input.maxHourlyRate) : 0.5;
        if (input.maxHourlyRate && hourlyRate <= input.maxHourlyRate) {
          reasons.push('within-budget');
        }

        const turnaroundHours = profile.turnaroundHours ?? 72;
        const turnaroundScore = 1 - normalize(turnaroundHours, 240);
        const complexityFit = input.complexityScore >= 3 ? Math.min(1, rating / 5) : 0.7;

        const score =
          (specialtyMatch ? 0.3 : 0) +
          (softwareMatch ? 0.25 : 0) +
          affordability * 0.15 +
          turnaroundScore * 0.1 +
          (rating / 5) * 0.15 +
          complexityFit * 0.05;

        return {
          id: editor.id,
          fullName: editor.fullName,
          avatarUrl: editor.avatarUrl,
          hourlyRate,
          score,
          reasons
        };
      })
      .filter((item): item is SuggestedEditor => Boolean(item))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return ranked;
  }
}

export const editorMatchingService = new EditorMatchingService();
