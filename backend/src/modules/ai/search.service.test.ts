import { SearchService } from './search.service.js';

describe('SearchService', () => {
  const service = new SearchService();

  it('parses natural language with heuristic fallback', async () => {
    const filters = await service.parseNaturalLanguage('Find me a wedding photographer in NYC under $200 with 4.5 stars');

    expect(filters.specialty).toBe('wedding');
    expect(filters.maxPrice).toBe(200);
    expect(filters.minRating).toBe(4.5);
  });

  it('creates deterministic fallback embeddings', async () => {
    const first = await service.generateEmbedding('wedding photographer nyc');
    const second = await service.generateEmbedding('wedding photographer nyc');

    expect(first.length).toBeGreaterThan(10);
    expect(first).toEqual(second);
  });

  it('ranks creators by AI relevance', async () => {
    const embedding = await service.generateEmbedding('wedding in new york');

    const ranked = await service.rankCreators(
      [
        {
          id: 'creator-a',
          fullName: 'Alice',
          creatorProfile: {
            city: 'New York',
            bio: 'Wedding and candid photographer',
            ratingAverage: '4.9'
          }
        },
        {
          id: 'creator-b',
          fullName: 'Bob',
          creatorProfile: {
            city: 'Los Angeles',
            bio: 'Product photo specialist',
            ratingAverage: '4.2'
          }
        }
      ],
      embedding,
      {
        vectorScores: [
          { creatorId: 'creator-a', score: 0.92 },
          { creatorId: 'creator-b', score: 0.35 }
        ]
      }
    );

    expect(ranked[0]?.id).toBe('creator-a');
    expect((ranked[0]?.aiRelevance ?? 0)).toBeGreaterThan(ranked[1]?.aiRelevance ?? 0);
  });
});
