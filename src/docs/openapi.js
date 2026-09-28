const env = require('../config/env');

const shortCodeSchema = {
  type: 'string',
  minLength: 4,
  maxLength: 10,
  pattern: '^[A-Za-z0-9]+$',
  description: '4–10 letters or numbers.',
  example: 'example1',
};

const errorResponse = {
  description: 'JSON error envelope.',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
    },
  },
};

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'URL Shortener API',
    version: '1.0.0',
    description:
      'Creates short links, stores them in MongoDB, and redirects visitors to the original URL. ' +
      '`GET /api/urls/{shortCode}` returns metadata and does not increment clicks. ' +
      '`GET /{shortCode}` redirects and increments clicks.',
  },
  servers: [
    {
      url: env.baseUrl,
      description: 'Server configured by BASE_URL',
    },
  ],
  tags: [
    { name: 'Health', description: 'Application and database status' },
    { name: 'URLs', description: 'Create, list, read, and delete short URLs' },
    { name: 'Redirect', description: 'Public redirect that increments clicks' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description:
          'Reports whether MongoDB is connected. ' +
          '`database` is the Mongoose connection state: `connected`, `disconnected`, `connecting`, or `disconnecting`. ' +
          'An unrecognized state is reported as `disconnected`. ' +
          'The response is `200` only when the state is `connected`. Any other state returns `503`.',
        operationId: 'getHealth',
        responses: {
          200: {
            description: 'The application is running and MongoDB is connected.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
                example: {
                  success: true,
                  data: {
                    status: 'ok',
                    database: 'connected',
                  },
                },
              },
            },
          },
          503: {
            description: 'MongoDB is not connected.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
                example: {
                  success: false,
                  data: {
                    status: 'error',
                    database: 'disconnected',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/urls': {
      post: {
        tags: ['URLs'],
        summary: 'Create a short URL',
        description:
          'Stores an HTTP or HTTPS URL and returns its short link. ' +
          '`originalUrl` is required and must use the `http` or `https` protocol. Leading and trailing whitespace is trimmed. ' +
          '`shortCode` is optional. When it is omitted, the API generates an alphanumeric code whose length is `SHORT_CODE_LENGTH` (default 6). ' +
          'A custom code must be 4–10 letters or numbers. Whitespace around a custom code is trimmed. ' +
          'The `201` body includes `originalUrl`, `shortCode`, and `shortUrl` only. `shortUrl` is `BASE_URL` plus the code.',
        operationId: 'createUrl',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUrlRequest' },
              examples: {
                customCode: {
                  summary: 'Custom short code',
                  value: {
                    originalUrl: 'https://example.com',
                    shortCode: 'example1',
                  },
                },
                generatedCode: {
                  summary: 'Generated short code',
                  value: {
                    originalUrl: 'https://example.com',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Short URL created.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['success', 'data'],
                  properties: {
                    success: { type: 'boolean', enum: [true] },
                    data: { $ref: '#/components/schemas/Url' },
                  },
                },
                example: {
                  success: true,
                  data: {
                    originalUrl: 'https://example.com',
                    shortCode: 'example1',
                    shortUrl: `${env.baseUrl}/example1`,
                  },
                },
              },
            },
          },
          400: {
            ...errorResponse,
            description:
              'The body is not a JSON object, `originalUrl` is missing or not an HTTP/HTTPS URL, or `shortCode` is not 4–10 letters or numbers.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  invalidUrl: {
                    summary: 'Invalid originalUrl',
                    value: {
                      success: false,
                      message: 'Validation failed',
                      errors: [
                        { field: 'originalUrl', message: 'originalUrl must be a valid URL' },
                      ],
                    },
                  },
                  unsupportedProtocol: {
                    summary: 'Protocol is not HTTP or HTTPS',
                    value: {
                      success: false,
                      message: 'Validation failed',
                      errors: [
                        { field: 'originalUrl', message: 'originalUrl must use HTTP or HTTPS' },
                      ],
                    },
                  },
                  invalidShortCode: {
                    summary: 'Invalid shortCode',
                    value: {
                      success: false,
                      message: 'Validation failed',
                      errors: [
                        { field: 'shortCode', message: 'shortCode must be 4-10 letters or numbers' },
                      ],
                    },
                  },
                },
              },
            },
          },
          409: {
            ...errorResponse,
            description: 'The custom short code is already stored.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  success: false,
                  message: 'shortCode already exists',
                  errors: [],
                },
              },
            },
          },
          500: {
            ...errorResponse,
            description:
              'A unique generated short code could not be saved after repeated attempts (`Unable to generate a unique short code`). ' +
              'Other unexpected failures return `Internal server error`.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  success: false,
                  message: 'Unable to generate a unique short code',
                  errors: [],
                },
              },
            },
          },
        },
      },
      get: {
        tags: ['URLs'],
        summary: 'List short URLs',
        description:
          'Returns a page of short URLs, newest first (`createdAt` descending). ' +
          'Omitted `page` defaults to 1. Omitted `limit` defaults to 10. ' +
          'When present, both values must be positive integers with no leading zeros. `limit` cannot be greater than 50. ' +
          'Invalid values return `400` and are not replaced with the defaults. ' +
          'A page past the end of the collection returns `200` with `items` set to an empty array. ' +
          '`totalPages` is 0 when there are no stored URLs. ' +
          'Each item is metadata and does not include `_id` or `__v`.',
        operationId: 'listUrls',
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            description:
              'Page number. Defaults to 1 when omitted. Must be a positive integer. Invalid values return 400.',
            schema: {
              type: 'integer',
              minimum: 1,
              default: 1,
              example: 1,
            },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description:
              'Page size. Defaults to 10 when omitted. Must be a positive integer no greater than 50. Invalid values return 400.',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 10,
              example: 10,
            },
          },
        ],
        responses: {
          200: {
            description: 'A page of short URL metadata.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginationResponse' },
                example: {
                  success: true,
                  data: {
                    items: [
                      {
                        originalUrl: 'https://example.com',
                        shortCode: 'abc123',
                        shortUrl: `${env.baseUrl}/abc123`,
                        clicks: 5,
                        createdAt: '2026-09-28T00:00:00.000Z',
                        updatedAt: '2026-09-28T00:00:00.000Z',
                      },
                    ],
                    pagination: {
                      page: 1,
                      limit: 10,
                      totalItems: 25,
                      totalPages: 3,
                      hasNextPage: true,
                      hasPreviousPage: false,
                    },
                  },
                },
              },
            },
          },
          400: {
            ...errorResponse,
            description: '`page` or `limit` is missing the required positive-integer format, or `limit` is greater than 50.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  invalidPage: {
                    summary: 'page is not a positive integer',
                    value: {
                      success: false,
                      message: 'Validation failed',
                      errors: [{ field: 'page', message: 'page must be a positive integer' }],
                    },
                  },
                  limitTooHigh: {
                    summary: 'limit exceeds 50',
                    value: {
                      success: false,
                      message: 'Validation failed',
                      errors: [{ field: 'limit', message: 'limit cannot exceed 50' }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/urls/{shortCode}': {
      get: {
        tags: ['URLs'],
        summary: 'Get short URL metadata',
        description:
          'Returns stored metadata for one short code. This endpoint does not increment `clicks`. ' +
          'The path parameter must be 4–10 letters or numbers. ' +
          'The response includes `originalUrl`, `shortCode`, `shortUrl`, `clicks`, `createdAt`, and `updatedAt`. ' +
          '`shortUrl` is built from `BASE_URL`. `_id` and `__v` are omitted.',
        operationId: 'getUrlByShortCode',
        parameters: [{ $ref: '#/components/parameters/ShortCode' }],
        responses: {
          200: {
            description: 'Metadata for the short URL. Clicks are unchanged.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['success', 'data'],
                  properties: {
                    success: { type: 'boolean', enum: [true] },
                    data: { $ref: '#/components/schemas/UrlMetadata' },
                  },
                },
                example: {
                  success: true,
                  data: {
                    originalUrl: 'https://example.com',
                    shortCode: 'example1',
                    shortUrl: `${env.baseUrl}/example1`,
                    clicks: 0,
                    createdAt: '2026-09-28T00:00:00.000Z',
                    updatedAt: '2026-09-28T00:00:00.000Z',
                  },
                },
              },
            },
          },
          400: {
            ...errorResponse,
            description: 'The short code is not 4–10 letters or numbers.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  success: false,
                  message: 'Validation failed',
                  errors: [
                    { field: 'shortCode', message: 'shortCode must be 4-10 letters or numbers' },
                  ],
                },
              },
            },
          },
          404: {
            ...errorResponse,
            description: 'No short URL is stored for this code.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  success: false,
                  message: 'Short URL not found',
                  errors: [],
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ['URLs'],
        summary: 'Delete a short URL',
        description:
          'Deletes the stored short URL. A successful deletion returns `204` and an empty response body. ' +
          'The path parameter must be 4–10 letters or numbers.',
        operationId: 'deleteUrl',
        parameters: [{ $ref: '#/components/parameters/ShortCode' }],
        responses: {
          204: {
            description: 'The short URL was deleted. The response body is empty.',
          },
          400: {
            ...errorResponse,
            description: 'The short code is not 4–10 letters or numbers.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  success: false,
                  message: 'Validation failed',
                  errors: [
                    { field: 'shortCode', message: 'shortCode must be 4-10 letters or numbers' },
                  ],
                },
              },
            },
          },
          404: {
            ...errorResponse,
            description: 'No short URL is stored for this code.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  success: false,
                  message: 'Short URL not found',
                  errors: [],
                },
              },
            },
          },
        },
      },
    },
    '/{shortCode}': {
      get: {
        tags: ['Redirect'],
        summary: 'Redirect to the original URL',
        description:
          'Looks up the short code and, when it exists, responds with `302 Found`. ' +
          'The `Location` header is the stored original URL. The success response is a redirect, not a JSON body. ' +
          'Each successful redirect increments `clicks` by 1. ' +
          'A code that is not stored returns `404` JSON and does not increment clicks.',
        operationId: 'redirectToOriginalUrl',
        parameters: [
          {
            name: 'shortCode',
            in: 'path',
            required: true,
            description: 'Stored short code used to find the original URL.',
            schema: shortCodeSchema,
          },
        ],
        responses: {
          302: {
            description:
              'Redirect to the original URL. The `Location` header is that URL, and `clicks` is incremented by 1. ' +
              'This response is not JSON. Express sends a short plain-text redirect notice; clients follow `Location`.',
            headers: {
              Location: {
                description: 'The original URL stored for this short code.',
                schema: {
                  type: 'string',
                  format: 'uri',
                  example: 'https://example.com',
                },
              },
            },
          },
          404: {
            ...errorResponse,
            description: 'No short URL is stored for this code. Clicks are not incremented.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  success: false,
                  message: 'Short URL not found',
                  errors: [],
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    parameters: {
      ShortCode: {
        name: 'shortCode',
        in: 'path',
        required: true,
        description: '4–10 letters or numbers. Invalid values return 400.',
        schema: shortCodeSchema,
      },
    },
    schemas: {
      Url: {
        type: 'object',
        description: 'Short URL returned when a link is created. Clicks and timestamps are not included.',
        required: ['originalUrl', 'shortCode', 'shortUrl'],
        properties: {
          originalUrl: {
            type: 'string',
            format: 'uri',
            description: 'Stored HTTP or HTTPS URL.',
            example: 'https://example.com',
          },
          shortCode: shortCodeSchema,
          shortUrl: {
            type: 'string',
            format: 'uri',
            description: 'Public short link built from BASE_URL and the short code.',
            example: `${env.baseUrl}/example1`,
          },
        },
      },
      CreateUrlRequest: {
        type: 'object',
        required: ['originalUrl'],
        properties: {
          originalUrl: {
            type: 'string',
            description:
              'Required HTTP or HTTPS URL. Must be a valid absolute URL. Leading and trailing whitespace is trimmed.',
            example: 'https://example.com',
          },
          shortCode: {
            ...shortCodeSchema,
            description:
              'Optional custom code of 4–10 letters or numbers. Omit this field to generate a code. An empty or invalid value returns 400.',
          },
        },
      },
      UrlMetadata: {
        allOf: [
          { $ref: '#/components/schemas/Url' },
          {
            type: 'object',
            required: ['clicks', 'createdAt', 'updatedAt'],
            properties: {
              clicks: {
                type: 'integer',
                minimum: 0,
                description: 'Number of successful redirects. Reading metadata does not change this value.',
                example: 0,
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
                example: '2026-09-28T00:00:00.000Z',
              },
              updatedAt: {
                type: 'string',
                format: 'date-time',
                example: '2026-09-28T00:00:00.000Z',
              },
            },
          },
        ],
      },
      Pagination: {
        type: 'object',
        required: ['page', 'limit', 'totalItems', 'totalPages', 'hasNextPage', 'hasPreviousPage'],
        properties: {
          page: {
            type: 'integer',
            minimum: 1,
            description: 'Requested page. Defaults to 1.',
            example: 1,
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 50,
            description: 'Requested page size. Defaults to 10 and cannot exceed 50.',
            example: 10,
          },
          totalItems: {
            type: 'integer',
            minimum: 0,
            description: 'Total stored short URLs.',
            example: 25,
          },
          totalPages: {
            type: 'integer',
            minimum: 0,
            description: 'Total pages for the current limit. Zero when there are no stored URLs.',
            example: 3,
          },
          hasNextPage: {
            type: 'boolean',
            description: 'True when `page` is less than `totalPages`.',
            example: true,
          },
          hasPreviousPage: {
            type: 'boolean',
            description: 'True when `page` is greater than 1.',
            example: false,
          },
        },
      },
      PaginationResponse: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true], example: true },
          data: {
            type: 'object',
            required: ['items', 'pagination'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/UrlMetadata' },
              },
              pagination: { $ref: '#/components/schemas/Pagination' },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'message', 'errors'],
        properties: {
          success: { type: 'boolean', enum: [false], example: false },
          message: { type: 'string', example: 'Validation failed' },
          errors: {
            type: 'array',
            description: 'Field errors for validation failures. Empty for other errors.',
            items: {
              type: 'object',
              required: ['field', 'message'],
              properties: {
                field: { type: 'string', example: 'originalUrl' },
                message: { type: 'string', example: 'originalUrl must be a valid URL' },
              },
            },
          },
        },
      },
      HealthResponse: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: {
            type: 'boolean',
            description: 'True only when the database state is `connected`.',
          },
          data: {
            type: 'object',
            required: ['status', 'database'],
            properties: {
              status: {
                type: 'string',
                enum: ['ok', 'error'],
                description: '`ok` when connected, otherwise `error`.',
              },
              database: {
                type: 'string',
                enum: ['connected', 'disconnected', 'connecting', 'disconnecting'],
                description: 'Current Mongoose connection state.',
              },
            },
          },
        },
      },
    },
  },
};

module.exports = spec;
