const dotenv = require('dotenv');

dotenv.config();

const port = Number(process.env.PORT) || 3000;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

function readShortCodeLength() {
  const raw = process.env.SHORT_CODE_LENGTH;
  const length = raw === undefined || raw.trim() === '' ? 6 : Number(raw);

  if (!Number.isInteger(length) || length < 4 || length > 10) {
    throw new Error('SHORT_CODE_LENGTH must be an integer between 4 and 10');
  }

  return length;
}

function readBaseUrl() {
  const configured = process.env.BASE_URL && process.env.BASE_URL.trim();
  const raw = configured || `http://localhost:${port}`;
  let parsed;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('BASE_URL must be a valid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('BASE_URL must use HTTP or HTTPS');
  }

  return raw.replace(/\/$/, '');
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port,
  baseUrl: readBaseUrl(),
  shortCodeLength: readShortCodeLength(),
};

module.exports = env;
