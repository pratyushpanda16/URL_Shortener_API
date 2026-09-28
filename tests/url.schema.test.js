const Url = require('../src/models/url.model');

describe('Url schema indexes', () => {
  test('defines a unique shortCode index and a descending createdAt index', () => {
    expect(Url.schema.path('shortCode').options.unique).toBe(true);

    const createdAtIndexes = Url.schema.indexes().filter(([fields]) => fields.createdAt === -1);

    expect(createdAtIndexes).toHaveLength(1);
  });
});
