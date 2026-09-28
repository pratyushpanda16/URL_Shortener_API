const request = require('supertest');

jest.mock('../src/models/url.model', () => ({
  create: jest.fn(),
  exists: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

describe('GET /api/urls/:shortCode', () => {
  let app;
  let Url;
  let clicks;
  const createdAt = new Date('2026-09-28T00:00:00.000Z');
  const updatedAt = new Date('2026-09-28T01:00:00.000Z');

  function metadataDocument(shortCode) {
    return {
      _id: '507f1f77bcf86cd799439011',
      __v: 0,
      originalUrl: 'https://www.google.com',
      shortCode,
      clicks,
      createdAt,
      updatedAt,
    };
  }

  beforeEach(() => {
    jest.resetModules();
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.SHORT_CODE_LENGTH = '6';
    clicks = 2;
    Url = require('../src/models/url.model');
    app = require('../src/app');
    Url.exists.mockResolvedValue(null);
    Url.create.mockImplementation(async (doc) => doc);
    Url.findOne.mockImplementation(async (filter) => {
      if (filter.shortCode !== 'Nxoioh') {
        return null;
      }

      return metadataDocument(filter.shortCode);
    });
    Url.findOneAndUpdate.mockImplementation(async (filter, update) => {
      if (filter.shortCode !== 'Nxoioh') {
        return null;
      }

      clicks += update.$inc.clicks;
      return metadataDocument(filter.shortCode);
    });
  });

  test('returns metadata for an existing short code', async () => {
    const response = await request(app).get('/api/urls/Nxoioh');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        originalUrl: 'https://www.google.com',
        shortCode: 'Nxoioh',
        shortUrl: 'http://localhost:3000/Nxoioh',
        clicks: 2,
        createdAt: '2026-09-28T00:00:00.000Z',
        updatedAt: '2026-09-28T01:00:00.000Z',
      },
    });
    expect(response.body.data).not.toHaveProperty('_id');
    expect(response.body.data).not.toHaveProperty('__v');
    expect(Url.findOne).toHaveBeenCalledWith({ shortCode: 'Nxoioh' });
  });

  test('does not increment clicks', async () => {
    await request(app).get('/api/urls/Nxoioh');
    const second = await request(app).get('/api/urls/Nxoioh');

    expect(second.status).toBe(200);
    expect(second.body.data.clicks).toBe(2);
    expect(clicks).toBe(2);
    expect(Url.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('returns 404 for a valid short code that does not exist', async () => {
    const response = await request(app).get('/api/urls/Abcd99');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Short URL not found',
      errors: [],
    });
    expect(Url.findOne).toHaveBeenCalledWith({ shortCode: 'Abcd99' });
    expect(clicks).toBe(2);
  });

  test('returns 400 for an invalid short code without modifying it', async () => {
    const response = await request(app).get('/api/urls/ab-');
    const spaced = await request(app).get(
      `/api/urls/${encodeURIComponent('Nxoioh ')}`
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'shortCode',
          message: 'shortCode must be 4-10 letters or numbers',
        },
      ],
    });
    expect(spaced.status).toBe(400);
    expect(Url.findOne).not.toHaveBeenCalled();
    expect(Url.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('keeps create, redirect, and health routes working', async () => {
    const health = await request(app).get('/health');
    const created = await request(app).post('/api/urls').send({
      originalUrl: 'https://example.com',
      shortCode: 'myLink',
    });
    const redirect = await request(app).get('/Nxoioh').redirects(0);
    const metadata = await request(app).get('/api/urls/Nxoioh');

    expect(health.status).toBe(503);
    expect(health.body.data.status).toBe('error');
    expect(created.status).toBe(201);
    expect(created.body.data.shortUrl).toBe('http://localhost:3000/myLink');
    expect(redirect.status).toBe(302);
    expect(redirect.headers.location).toBe('https://www.google.com');
    expect(clicks).toBe(3);
    expect(metadata.status).toBe(200);
    expect(metadata.body.data.clicks).toBe(3);
  });
});
