const ApiError = require('../utils/ApiError');

const SHORT_CODE_PATTERN = /^[A-Za-z0-9]+$/;
const SHORT_CODE_MESSAGE = 'shortCode must be 4-10 letters or numbers';

function hasInvalidShortCodeFormat(value) {
  return (
    typeof value !== 'string' ||
    value.length < 4 ||
    value.length > 10 ||
    !SHORT_CODE_PATTERN.test(value)
  );
}

function validateOriginalUrl(value) {
  if (value === undefined || value === null || value === '') {
    return 'originalUrl is required';
  }

  if (typeof value !== 'string') {
    return 'originalUrl must be a string';
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return 'originalUrl is required';
  }

  let parsed;

  try {
    parsed = new URL(trimmed);
  } catch {
    return 'originalUrl must be a valid URL';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'originalUrl must use HTTP or HTTPS';
  }

  return { value: trimmed };
}

function validateShortCode(value) {
  if (value === undefined || value === null) {
    return { value: undefined };
  }

  if (typeof value !== 'string') {
    return 'shortCode must be a string';
  }

  const trimmed = value.trim();

  if (hasInvalidShortCodeFormat(trimmed)) {
    return SHORT_CODE_MESSAGE;
  }

  return { value: trimmed };
}

function validateShortCodeParam(value) {
  if (hasInvalidShortCodeFormat(value)) {
    throw new ApiError(400, 'Validation failed', [
      { field: 'shortCode', message: SHORT_CODE_MESSAGE },
    ]);
  }

  return value;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const POSITIVE_INTEGER = /^[1-9]\d*$/;

function readPositiveInteger(value, field) {
  if (typeof value !== 'string' || !POSITIVE_INTEGER.test(value)) {
    return `${field} must be a positive integer`;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    return `${field} must be a positive integer`;
  }

  return { value: parsed };
}

function validatePagination(query) {
  const errors = [];
  const page =
    query.page === undefined ? { value: DEFAULT_PAGE } : readPositiveInteger(query.page, 'page');
  const limit =
    query.limit === undefined
      ? { value: DEFAULT_LIMIT }
      : readPositiveInteger(query.limit, 'limit');

  if (typeof page === 'string') {
    errors.push({ field: 'page', message: page });
  }

  if (typeof limit === 'string') {
    errors.push({ field: 'limit', message: limit });
  } else if (limit.value > MAX_LIMIT) {
    errors.push({ field: 'limit', message: 'limit cannot exceed 50' });
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  return {
    page: page.value,
    limit: limit.value,
  };
}

function validateCreateUrl(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Validation failed', [
      { field: 'body', message: 'Request body must be a JSON object' },
    ]);
  }

  const errors = [];
  const originalUrl = validateOriginalUrl(body.originalUrl);
  const shortCode = validateShortCode(body.shortCode);

  if (typeof originalUrl === 'string') {
    errors.push({ field: 'originalUrl', message: originalUrl });
  }

  if (typeof shortCode === 'string') {
    errors.push({ field: 'shortCode', message: shortCode });
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  return {
    originalUrl: originalUrl.value,
    shortCode: shortCode.value,
  };
}

module.exports = {
  validateCreateUrl,
  validateShortCodeParam,
  validatePagination,
};
