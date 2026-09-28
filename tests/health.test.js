const request = require('supertest');
const app = require('../src/app');

describe('Phase 1 HTTP checks', () => {
  test('GET /health reports the current database state', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      data: {
        status: 'error',
        database: 'disconnected',
      },
    });
  });

  test('an unknown route returns 404', async () => {
    const response = await request(app).get('/unknown/route');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Route not found: GET /unknown/route',
      errors: [],
    });
  });
});
