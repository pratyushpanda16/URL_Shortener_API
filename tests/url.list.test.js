const request = require('supertest');

jest.mock('../src/models/url.model', () => ({
  create: jest.fn(),
  exists: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
  countDocuments: jest.fn(),
}));

describe('GET /api/urls', () => {
  let app;
  let Url;

  function document(shortCode, createdAt, clicks = 0) {
    return {
      _id: '507f1f77bcf86cd799439011',
      __v: 0,
      originalUrl: `https://example.com/${shortCode}`,
      shortCode,
      clicks,
      createdAt,
      updatedAt: createdAt,
    };
  }

  function useListResult(documents, totalItems) {
    const chain = {};
    chain.sort = jest.fn(() => chain);
    chain.skip = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);
    chain.lean = jest.fn(async () => documents);
    Url.find.mockReturnValue(chain);
    Url.countDocuments.mockResolvedValue(totalItems);
    return chain;
  }

  beforeEach(() => {
    jest.resetModules();
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.SHORT_CODE_LENGTH = '6';
    Url = require('../src/models/url.model');
    app = require('../src/app');
  });

  test('uses page 1 and limit 10 by default', async () => {
    const createdAt = new Date('2026-09-28T00:00:00.000Z');
    const chain = useListResult([document('newest', createdAt, 5)], 1);

    const response = await request(app).get('/api/urls');

    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(Url.countDocuments).toHaveBeenCalledWith();
  });

  test('uses a custom page with the default limit', async () => {
    const chain = useListResult([], 25);

    const response = await request(app).get('/api/urls?page=2');

    expect(response.status).toBe(200);
    expect(response.body.data.pagination.page).toBe(2);
    expect(response.body.data.pagination.limit).toBe(10);
    expect(chain.skip).toHaveBeenCalledWith(10);
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  test('uses a custom limit with the default page', async () => {
    const chain = useListResult([], 25);

    const response = await request(app).get('/api/urls?limit=20');

    expect(response.status).toBe(200);
    expect(response.body.data.pagination.page).toBe(1);
    expect(response.body.data.pagination.limit).toBe(20);
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  test('accepts the maximum limit of 50', async () => {
    const chain = useListResult([], 60);

    const response = await request(app).get('/api/urls?limit=50');

    expect(response.status).toBe(200);
    expect(response.body.data.pagination.limit).toBe(50);
    expect(response.body.data.pagination.totalPages).toBe(2);
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  test('returns 400 when page is 0', async () => {
    const response = await request(app).get('/api/urls?page=0');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'page', message: 'page must be a positive integer' }],
    });
    expect(Url.find).not.toHaveBeenCalled();
  });

  test('returns 400 when page is negative', async () => {
    const response = await request(app).get('/api/urls?page=-1');

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: 'page', message: 'page must be a positive integer' },
    ]);
    expect(Url.find).not.toHaveBeenCalled();
  });

  test('returns 400 when limit is 0', async () => {
    const response = await request(app).get('/api/urls?limit=0');

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: 'limit', message: 'limit must be a positive integer' },
    ]);
    expect(Url.find).not.toHaveBeenCalled();
  });

  test('returns 400 when limit is greater than 50', async () => {
    const response = await request(app).get('/api/urls?limit=100');

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: 'limit', message: 'limit cannot exceed 50' },
    ]);
    expect(Url.find).not.toHaveBeenCalled();
  });

  test('returns 400 when page is not numeric', async () => {
    const response = await request(app).get('/api/urls?page=abc');

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: 'page', message: 'page must be a positive integer' },
    ]);
    expect(Url.find).not.toHaveBeenCalled();
  });

  test('returns 400 when limit is not numeric', async () => {
    const response = await request(app).get('/api/urls?limit=ten');

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: 'limit', message: 'limit must be a positive integer' },
    ]);
    expect(Url.find).not.toHaveBeenCalled();
  });

  test('returns public URL items without internal fields', async () => {
    const createdAt = new Date('2026-09-28T03:00:00.000Z');
    useListResult([document('abc123', createdAt, 5)], 1);

    const response = await request(app).get('/api/urls');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toEqual([
      {
        originalUrl: 'https://example.com/abc123',
        shortCode: 'abc123',
        shortUrl: 'http://localhost:3000/abc123',
        clicks: 5,
        createdAt: '2026-09-28T03:00:00.000Z',
        updatedAt: '2026-09-28T03:00:00.000Z',
      },
    ]);
    expect(response.body.data.items[0]).not.toHaveProperty('_id');
    expect(response.body.data.items[0]).not.toHaveProperty('__v');
  });

  test('returns newest URLs first', async () => {
    const older = document('older1', new Date('2026-09-28T01:00:00.000Z'), 1);
    const newer = document('newer1', new Date('2026-09-28T02:00:00.000Z'), 4);
    const chain = useListResult([newer, older], 2);

    const response = await request(app).get('/api/urls');

    expect(response.status).toBe(200);
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(response.body.data.items.map((item) => item.shortCode)).toEqual([
      'newer1',
      'older1',
    ]);
  });

  test('returns totalItems, totalPages, and page flags', async () => {
    useListResult([document('page01', new Date('2026-09-28T04:00:00.000Z'))], 25);

    const first = await request(app).get('/api/urls?page=1&limit=10');
    const middle = await request(app).get('/api/urls?page=2&limit=10');
    const last = await request(app).get('/api/urls?page=3&limit=10');

    expect(first.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      totalItems: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(middle.body.data.pagination).toMatchObject({
      page: 2,
      totalItems: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
    expect(last.body.data.pagination).toMatchObject({
      page: 3,
      totalItems: 25,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  test('returns 200 and an empty item list for a page past the end', async () => {
    useListResult([], 25);

    const response = await request(app).get('/api/urls?page=999&limit=10');

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.pagination).toEqual({
      page: 999,
      limit: 10,
      totalItems: 25,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });
});

describe('existing endpoints still work', () => {
  let app;
  let Url;
  let urls;
  const createdAt = new Date('2026-09-28T00:00:00.000Z');
  const updatedAt = new Date('2026-09-28T01:00:00.000Z');

  function metadataDocument(shortCode) {
    const url = urls.get(shortCode);

    if (!url) {
      return null;
    }

    return {
      originalUrl: url.originalUrl,
      shortCode,
      clicks: url.clicks,
      createdAt,
      updatedAt,
    };
  }

  beforeEach(() => {
    jest.resetModules();
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.SHORT_CODE_LENGTH = '6';
    urls = new Map([
      ['Nxoioh', { originalUrl: 'https://www.google.com', clicks: 2 }],
    ]);
    Url = require('../src/models/url.model');
    app = require('../src/app');
    Url.exists.mockResolvedValue(null);
    Url.create.mockImplementation(async (doc) => doc);
    Url.findOne.mockImplementation(async (filter) => metadataDocument(filter.shortCode));
    Url.findOneAndUpdate.mockImplementation(async (filter, update) => {
      const url = urls.get(filter.shortCode);

      if (!url) {
        return null;
      }

      url.clicks += update.$inc.clicks;
      return metadataDocument(filter.shortCode);
    });
    Url.findOneAndDelete.mockImplementation(async (filter) => {
      const document = metadataDocument(filter.shortCode);

      if (!document) {
        return null;
      }

      urls.delete(filter.shortCode);
      return document;
    });
  });

  test('creates, reads, redirects, deletes, and reports health', async () => {
    const health = await request(app).get('/health');
    const created = await request(app).post('/api/urls').send({
      originalUrl: 'https://example.com',
      shortCode: 'myLink',
    });
    const metadata = await request(app).get('/api/urls/Nxoioh');
    const redirect = await request(app).get('/Nxoioh').redirects(0);
    const deleted = await request(app).delete('/api/urls/Nxoioh');

    expect(health.status).toBe(503);
    expect(health.body.data.status).toBe('error');
    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      success: true,
      data: {
        originalUrl: 'https://example.com',
        shortCode: 'myLink',
        shortUrl: 'http://localhost:3000/myLink',
      },
    });
    expect(metadata.status).toBe(200);
    expect(metadata.body.data.shortCode).toBe('Nxoioh');
    expect(metadata.body.data.clicks).toBe(2);
    expect(redirect.status).toBe(302);
    expect(redirect.headers.location).toBe('https://www.google.com');
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe('');
  });
});
