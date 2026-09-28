const request = require('supertest');

jest.mock('../src/models/url.model', () => ({
  create: jest.fn(),
  exists: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
}));

describe('DELETE /api/urls/:shortCode', () => {
  let app;
  let Url;
  let clicks;
  let urls;
  const createdAt = new Date('2026-09-28T00:00:00.000Z');
  const updatedAt = new Date('2026-09-28T01:00:00.000Z');

  function metadataDocument(shortCode) {
    const url = urls.get(shortCode);

    if (!url) {
      return null;
    }

    return {
      _id: '507f1f77bcf86cd799439011',
      __v: 0,
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
    clicks = 2;
    urls = new Map([
      ['Nxoioh', { originalUrl: 'https://www.google.com', clicks }],
      ['Keep01', { originalUrl: 'https://example.com/keep', clicks: 0 }],
    ]);
    Url = require('../src/models/url.model');
    app = require('../src/app');
    Url.exists.mockResolvedValue(null);
    Url.create.mockImplementation(async (doc) => {
      urls.set(doc.shortCode, { originalUrl: doc.originalUrl, clicks: 0 });
      return doc;
    });
    Url.findOne.mockImplementation(async (filter) => metadataDocument(filter.shortCode));
    Url.findOneAndUpdate.mockImplementation(async (filter, update) => {
      const url = urls.get(filter.shortCode);

      if (!url) {
        return null;
      }

      url.clicks += update.$inc.clicks;
      clicks = urls.get('Nxoioh') ? urls.get('Nxoioh').clicks : clicks;
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

  test('deletes an existing short code and returns 204 with no body', async () => {
    const response = await request(app).delete('/api/urls/Nxoioh');

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(response.body).toEqual({});
    expect(Url.findOneAndDelete).toHaveBeenCalledWith({ shortCode: 'Nxoioh' });
    expect(urls.has('Nxoioh')).toBe(false);
  });

  test('returns 404 for a valid short code that does not exist', async () => {
    const response = await request(app).delete('/api/urls/Abcd99');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Short URL not found',
      errors: [],
    });
    expect(Url.findOneAndDelete).toHaveBeenCalledWith({ shortCode: 'Abcd99' });
    expect(urls.has('Nxoioh')).toBe(true);
  });

  test('returns 400 for an invalid short code without modifying it', async () => {
    const response = await request(app).delete('/api/urls/ab-');
    const spaced = await request(app).delete(
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
    expect(Url.findOneAndDelete).not.toHaveBeenCalled();
    expect(urls.has('Nxoioh')).toBe(true);
  });

  test('returns 404 for metadata and redirect after deletion', async () => {
    const deleted = await request(app).delete('/api/urls/Nxoioh');
    const metadata = await request(app).get('/api/urls/Nxoioh');
    const redirect = await request(app).get('/Nxoioh').redirects(0);

    expect(deleted.status).toBe(204);
    expect(metadata.status).toBe(404);
    expect(metadata.body.message).toBe('Short URL not found');
    expect(redirect.status).toBe(404);
    expect(redirect.body.message).toBe('Short URL not found');
    expect(Url.findOneAndUpdate).toHaveBeenCalledWith(
      { shortCode: 'Nxoioh' },
      { $inc: { clicks: 1 } },
      { returnDocument: 'after' }
    );
  });

  test('keeps create, metadata, redirect, and health routes working', async () => {
    const health = await request(app).get('/health');
    const created = await request(app).post('/api/urls').send({
      originalUrl: 'https://example.com',
      shortCode: 'myLink',
    });
    const redirect = await request(app).get('/Keep01').redirects(0);
    const metadata = await request(app).get('/api/urls/Keep01');

    expect(health.status).toBe(503);
    expect(health.body.data.status).toBe('error');
    expect(created.status).toBe(201);
    expect(created.body.data.shortUrl).toBe('http://localhost:3000/myLink');
    expect(redirect.status).toBe(302);
    expect(redirect.headers.location).toBe('https://example.com/keep');
    expect(metadata.status).toBe(200);
    expect(metadata.body.data).toEqual({
      originalUrl: 'https://example.com/keep',
      shortCode: 'Keep01',
      shortUrl: 'http://localhost:3000/Keep01',
      clicks: 1,
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T01:00:00.000Z',
    });
    expect(urls.has('Nxoioh')).toBe(true);
  });
});
