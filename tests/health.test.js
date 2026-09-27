const request = require('supertest');
const app = require('../src/app');

describe('Phase 1 HTTP checks', () => {
  test('GET /health returns 200', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        status: 'ok',
      },
    });
  });

  test('an unknown route returns 404', async () => {
    const response = await request(app).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Route not found: GET /does-not-exist',
      errors: [],
    });
  });
});
