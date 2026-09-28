const request = require('supertest');

jest.mock('../src/models/url.model', () => ({
  create: jest.fn(),
  exists: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

describe('GET /:shortCode', () => {
  let app;
  let Url;
  let clicks;

  beforeEach(() => {
    jest.resetModules();
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.SHORT_CODE_LENGTH = '6';
    clicks = 0;
    Url = require('../src/models/url.model');
    app = require('../src/app');
    Url.exists.mockResolvedValue(null);
    Url.create.mockImplementation(async (doc) => doc);
    Url.findOneAndUpdate.mockImplementation(async (filter, update) => {
      if (filter.shortCode !== 'aB72xQ') {
        return null;
      }

      clicks += update.$inc.clicks;

      return {
        originalUrl: 'https://www.google.com',
        shortCode: filter.shortCode,
        clicks,
      };
    });
  });

  test('redirects an existing short code with HTTP 302', async () => {
    const response = await request(app).get('/aB72xQ').redirects(0);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('https://www.google.com');
    expect(response.body).toEqual({});
    expect(Url.findOneAndUpdate).toHaveBeenCalledWith(
      { shortCode: 'aB72xQ' },
      { $inc: { clicks: 1 } },
      { returnDocument: 'after' }
    );
  });

  test('increments clicks on each redirect', async () => {
    await request(app).get('/aB72xQ').redirects(0);
    const second = await request(app).get('/aB72xQ').redirects(0);

    expect(second.status).toBe(302);
    expect(second.headers.location).toBe('https://www.google.com');
    expect(clicks).toBe(2);
    expect(Url.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  test('returns 404 for an unknown short code', async () => {
    const response = await request(app).get('/doesnotexist').redirects(0);

    expect(response.status).toBe(404);
    expect(response.headers.location).toBeUndefined();
    expect(response.body).toEqual({
      success: false,
      message: 'Short URL not found',
      errors: [],
    });
    expect(clicks).toBe(0);
  });

  test('keeps health and create routes working', async () => {
    const health = await request(app).get('/health');
    const created = await request(app).post('/api/urls').send({
      originalUrl: 'https://example.com',
      shortCode: 'myLink',
    });

    expect(health.status).toBe(503);
    expect(health.body.data.status).toBe('error');
    expect(created.status).toBe(201);
    expect(created.body.data.shortUrl).toBe('http://localhost:3000/myLink');
    expect(Url.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
