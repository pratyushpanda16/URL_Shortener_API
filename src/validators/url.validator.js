const ApiError = require('../utils/ApiError');

const SHORT_CODE_PATTERN = /^[A-Za-z0-9]+$/;

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

  if (
    trimmed.length < 4 ||
    trimmed.length > 10 ||
    !SHORT_CODE_PATTERN.test(trimmed)
  ) {
    return 'shortCode must be 4-10 letters or numbers';
  }

  return { value: trimmed };
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
};
