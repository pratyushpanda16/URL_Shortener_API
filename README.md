# URL Shortener API

A REST API that creates short links, redirects visitors to the original URL, and stores each link in MongoDB.

## Features

- Create a short URL with a generated or custom short code
- Redirect `GET /:shortCode` to the original URL and increment a click count
- Read metadata for one short URL
- List shortened URLs with page and limit controls
- Delete a short URL
- Health check that reports the MongoDB connection state
- Request logging, input validation, and centralized error handling

## Tech stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- Jest and Supertest for API tests

## Project structure

```
src/
  app.js                  Express app and route mounting
  server.js               Connects to MongoDB, then starts listening
  config/                 Environment variables and database connection
  controllers/            Request handlers
  middleware/             Request logging, 404s, and error responses
  models/                 Mongoose URL schema
  routes/                 HTTP routes
  utils/                  ApiError, asyncHandler, short-code generation
  validators/             Input validation
tests/                    API tests that mock the URL model
```

Routes, controllers, models, middleware, configuration, and utilities are separate. Route files delegate to controllers.

## Environment variables

Copy `.env.example` to `.env` and set the values there. `.env` is gitignored.

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Port the server listens on. Defaults to `3000`. |
| `MONGODB_URI` | Yes | MongoDB connection string. Must start with `mongodb://` or `mongodb+srv://`. |
| `BASE_URL` | No | Public base used to build `shortUrl`. Defaults to `http://localhost:<PORT>`. Trailing slashes are removed. |
| `SHORT_CODE_LENGTH` | No | Length of generated short codes. Integer from 4 to 10. Defaults to `6`. |
| `NODE_ENV` | No | `development` when unset. Unexpected server errors still return a generic message. |

Do not commit real credentials. `.env.example` leaves `MONGODB_URI` empty.

## MongoDB setup

1. Create a MongoDB database, including MongoDB Atlas if you want a hosted cluster.
2. Put the connection string in `MONGODB_URI`.
3. Include a database name in the URI path if you do not want MongoDB's default database.
4. Start the API. It connects before it accepts requests.

The `Url` collection uses a unique index on `shortCode` and a descending index on `createdAt` for newest-first list queries.

## Installation

```bash
npm install
```

## Running locally

```bash
npm run dev
```

`npm start` runs the server without file watching.

The process exits if MongoDB cannot be reached or if the port is already in use.

## API endpoints

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/api/urls` | Create a short URL. `201` |
| `GET` | `/api/urls` | Paginated list of short URLs. `200` |
| `GET` | `/api/urls/:shortCode` | Metadata for one short URL. `200` |
| `DELETE` | `/api/urls/:shortCode` | Delete a short URL. `204` with an empty body |
| `GET` | `/:shortCode` | Redirect to the original URL. `302` |
| `GET` | `/health` | Database connection status. `200` when connected, `503` otherwise |

`GET /api/urls/:shortCode` returns JSON metadata and does not increment clicks.

`GET /:shortCode` is the public redirect. It responds with HTTP 302 and increments `clicks`. It does not return the `{ success, data }` JSON envelope.

### Create a short URL

```http
POST /api/urls
Content-Type: application/json

{
  "originalUrl": "https://example.com",
  "shortCode": "myLink"
}
```

`shortCode` is optional. When it is omitted, the API generates an alphanumeric code using `SHORT_CODE_LENGTH`.

```json
{
  "success": true,
  "data": {
    "originalUrl": "https://example.com",
    "shortCode": "myLink",
    "shortUrl": "http://localhost:3000/myLink"
  }
}
```

`originalUrl` must be an HTTP or HTTPS URL. A custom `shortCode` must be 4 to 10 letters or numbers. A duplicate custom code returns `409`.

### List short URLs

```http
GET /api/urls?page=1&limit=10
```

Omitted `page` defaults to `1`. Omitted `limit` defaults to `10`. `limit` cannot be greater than `50`.

`page` and `limit` must be positive integers when they are present. Invalid values return `400`. They are not replaced with the defaults.

Results are ordered by `createdAt` descending, so the newest URLs come first.

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "originalUrl": "https://example.com",
        "shortCode": "abc123",
        "shortUrl": "http://localhost:3000/abc123",
        "clicks": 5,
        "createdAt": "2026-09-28T00:00:00.000Z",
        "updatedAt": "2026-09-28T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 25,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

`shortUrl` is built from `BASE_URL`. Responses do not include `_id` or `__v`.

A page past the end of the collection is not an error. `GET /api/urls?page=999&limit=10` returns `200` with `items: []` and the pagination metadata for that page.

### Metadata

```http
GET /api/urls/myLink
```

```json
{
  "success": true,
  "data": {
    "originalUrl": "https://example.com",
    "shortCode": "myLink",
    "shortUrl": "http://localhost:3000/myLink",
    "clicks": 0,
    "createdAt": "2026-09-28T00:00:00.000Z",
    "updatedAt": "2026-09-28T00:00:00.000Z"
  }
}
```

### Redirect

```http
GET /myLink
```

Response status is `302`, and the `Location` header is the original URL. Each successful redirect increments `clicks` by 1.

### Delete

```http
DELETE /api/urls/myLink
```

A successful delete returns `204` and no body. Later metadata and redirect requests for that code return `404`.

### Health

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected"
  }
}
```

## Error handling

JSON errors use one shape:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "originalUrl",
      "message": "originalUrl must be a valid URL"
    }
  ]
}
```

`errors` is an empty array when the error is not a field validation failure.

| Status | When |
| --- | --- |
| `400` | Invalid JSON body, URL, short code, or pagination query |
| `404` | Unknown route, or a valid short code that is not stored |
| `409` | Custom short code already exists |
| `500` | Unexpected failure. The response message is `Internal server error` and does not include a stack trace |
| `503` | `/health` while MongoDB is not connected |

Unknown routes go through the same error handler as application errors.

## Testing

```bash
npm test
```

The tests call the Express app with Supertest and mock the Mongoose model. They cover create, list, metadata, redirect, delete, health, validation failures, and unknown routes. They do not require a running MongoDB instance.

## Architecture

- `src/routes` maps HTTP methods to controller functions.
- `src/controllers` validates input, calls the model, and sends the response.
- `src/models` defines the URL schema, unique `shortCode` index, and `createdAt` index.
- `src/validators` checks request bodies and query parameters and throws `ApiError` for invalid input.
- `asyncHandler` forwards rejected controller promises to the error middleware.
- `requestLogger` logs the HTTP method, path, status code, and duration. It does not log request bodies or credentials.
