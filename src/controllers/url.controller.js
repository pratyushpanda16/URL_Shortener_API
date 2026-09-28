const Url = require('../models/url.model');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { generateShortCode } = require('../utils/shortCode');
const { validateCreateUrl } = require('../validators/url.validator');

const MAX_GENERATION_ATTEMPTS = 5;

function isDuplicateKeyError(error) {
  const code = error && (error.code || (error.cause && error.cause.code));
  return code === 11000 || code === 11001;
}

function buildUrlResponse(originalUrl, shortCode) {
  return {
    originalUrl,
    shortCode,
    shortUrl: `${env.baseUrl}/${shortCode}`,
  };
}

async function saveUrl(originalUrl, shortCode) {
  const existing = await Url.exists({ shortCode });

  if (existing) {
    return { conflict: true };
  }

  try {
    await Url.create({ originalUrl, shortCode });
    return { conflict: false };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { conflict: true };
    }

    throw error;
  }
}

const createUrl = asyncHandler(async (req, res) => {
  const { originalUrl, shortCode } = validateCreateUrl(req.body);

  if (shortCode) {
    const saved = await saveUrl(originalUrl, shortCode);

    if (saved.conflict) {
      throw new ApiError(409, 'shortCode already exists');
    }

    return res.status(201).json({
      success: true,
      data: buildUrlResponse(originalUrl, shortCode),
    });
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const generated = generateShortCode();
    const saved = await saveUrl(originalUrl, generated);

    if (!saved.conflict) {
      return res.status(201).json({
        success: true,
        data: buildUrlResponse(originalUrl, generated),
      });
    }
  }

  throw new ApiError(500, 'Unable to generate a unique short code');
});

module.exports = {
  createUrl,
};
