const request = require('supertest');
const app = require('../src/app');

describe('GET /api-docs', () => {
  test('serves Swagger UI', async () => {
    const response = await request(app).get('/api-docs/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/html/);
    expect(response.text).toMatch(/Swagger UI/);
  });

  test('GET /api-docs redirects to Swagger UI', async () => {
    const response = await request(app).get('/api-docs').redirects(1);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/html/);
    expect(response.text).toMatch(/Swagger UI/);
  });
});
