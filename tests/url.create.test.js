const request = require('supertest');

jest.mock('../src/models/url.model', () => ({
  create: jest.fn(),
  exists: jest.fn(),
}));

describe('POST /api/urls', () => {
  let app;
  let Url;

  beforeEach(() => {
    jest.resetModules();
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.SHORT_CODE_LENGTH = '6';
    Url = require('../src/models/url.model');
    app = require('../src/app');
    Url.exists.mockResolvedValue(null);
    Url.create.mockImplementation(async (doc) => doc);
  });

  test('creates a URL with a generated short code', async () => {
    const response = await request(app).post('/api/urls').send({
      originalUrl: 'https://example.com',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.originalUrl).toBe('https://example.com');
    expect(response.body.data.shortCode).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(response.body.data.shortUrl).toBe(
      `http://localhost:3000/${response.body.data.shortCode}`
    );
    expect(response.body.data).not.toHaveProperty('_id');
    expect(response.body.data).not.toHaveProperty('clicks');
    expect(Url.create).toHaveBeenCalledWith({
      originalUrl: 'https://example.com',
      shortCode: response.body.data.shortCode,
    });
  });

  test('creates a URL with a custom short code', async () => {
    const response = await request(app).post('/api/urls').send({
      originalUrl: '  https://example.com/some/path?query=1  ',
      shortCode: ' myLink ',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: {
        originalUrl: 'https://example.com/some/path?query=1',
        shortCode: 'myLink',
        shortUrl: 'http://localhost:3000/myLink',
      },
    });
  });

  test('builds shortUrl from BASE_URL', async () => {
    jest.resetModules();
    process.env.BASE_URL = 'https://short.example/base/';
    process.env.SHORT_CODE_LENGTH = '6';
    Url = require('../src/models/url.model');
    app = require('../src/app');
    Url.exists.mockResolvedValue(null);
    Url.create.mockImplementation(async (doc) => doc);

    const response = await request(app).post('/api/urls').send({
      originalUrl: 'http://example.com/path',
      shortCode: 'link1',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.shortUrl).toBe('https://short.example/base/link1');
  });

  test('rejects an invalid URL', async () => {
    const response = await request(app).post('/api/urls').send({
      originalUrl: 'example.com',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors).toEqual([
      { field: 'originalUrl', message: 'originalUrl must be a valid URL' },
    ]);
    expect(Url.create).not.toHaveBeenCalled();
  });

  test('rejects an unsupported protocol', async () => {
    const response = await request(app).post('/api/urls').send({
      originalUrl: 'ftp://example.com',
    });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: 'originalUrl', message: 'originalUrl must use HTTP or HTTPS' },
    ]);
  });

  test.each([
    ['ab', 'too short'],
    ['has space', 'contains a space'],
    ['bad-code', 'contains a special character'],
    [123456, 'is not a string'],
  ])('rejects a shortCode that %s', async (shortCode) => {
    const response = await request(app).post('/api/urls').send({
      originalUrl: 'https://example.com',
      shortCode,
    });

    expect(response.status).toBe(400);
    expect(response.body.errors[0].field).toBe('shortCode');
    expect(Url.create).not.toHaveBeenCalled();
  });

  test('rejects an empty originalUrl and a null originalUrl', async () => {
    const empty = await request(app).post('/api/urls').send({ originalUrl: '' });
    const missing = await request(app).post('/api/urls').send({ originalUrl: null });

    expect(empty.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(empty.body.errors[0].message).toBe('originalUrl is required');
    expect(missing.body.errors[0].message).toBe('originalUrl is required');
  });

  test('returns 409 when a custom shortCode already exists', async () => {
    Url.exists.mockResolvedValue({ _id: 'existing' });

    const response = await request(app).post('/api/urls').send({
      originalUrl: 'https://example.com',
      shortCode: 'myLink',
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message: 'shortCode already exists',
      errors: [],
    });
    expect(Url.create).not.toHaveBeenCalled();
  });

  test('returns 409 when a custom shortCode loses a duplicate-key race', async () => {
    const duplicate = new Error('E11000 duplicate key');
    duplicate.code = 11000;
    Url.create.mockRejectedValue(duplicate);

    const response = await request(app).post('/api/urls').send({
      originalUrl: 'https://example.com',
      shortCode: 'myLink',
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('shortCode already exists');
    expect(response.body.message).not.toMatch(/E11000/);
  });

  test('retries when a generated shortCode collides', async () => {
    const duplicate = new Error('E11000 duplicate key');
    duplicate.code = 11000;
    Url.create
      .mockRejectedValueOnce(duplicate)
      .mockImplementationOnce(async (doc) => doc);

    const response = await request(app).post('/api/urls').send({
      originalUrl: 'https://example.com',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.shortCode).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(Url.create).toHaveBeenCalledTimes(2);
  });
});
