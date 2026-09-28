const Url = require('../models/url.model');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { generateShortCode } = require('../utils/shortCode');
const {
  validateCreateUrl,
  validateShortCodeParam,
  validatePagination,
} = require('../validators/url.validator');

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

function toPublicUrl(url) {
  return {
    originalUrl: url.originalUrl,
    shortCode: url.shortCode,
    shortUrl: `${env.baseUrl}/${url.shortCode}`,
    clicks: url.clicks,
    createdAt: url.createdAt,
    updatedAt: url.updatedAt,
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

const getUrlByShortCode = asyncHandler(async (req, res) => {
  const shortCode = validateShortCodeParam(req.params.shortCode);
  const url = await Url.findOne({ shortCode });

  if (!url) {
    throw new ApiError(404, 'Short URL not found');
  }

  return res.status(200).json({
    success: true,
    data: toPublicUrl(url),
  });
});

const listUrls = asyncHandler(async (req, res) => {
  const { page, limit } = validatePagination(req.query);
  const skip = (page - 1) * limit;

  const [documents, totalItems] = await Promise.all([
    Url.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Url.countDocuments(),
  ]);

  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

  return res.status(200).json({
    success: true,
    data: {
      items: documents.map((url) => toPublicUrl(url)),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    },
  });
});

const redirectUrl = asyncHandler(async (req, res) => {
  const url = await Url.findOneAndUpdate(
    { shortCode: req.params.shortCode },
    { $inc: { clicks: 1 } },
    { returnDocument: 'after' }
  );

  if (!url) {
    throw new ApiError(404, 'Short URL not found');
  }

  return res.redirect(302, url.originalUrl);
});

const deleteUrl = asyncHandler(async (req, res) => {
  const shortCode = validateShortCodeParam(req.params.shortCode);
  const deleted = await Url.findOneAndDelete({ shortCode });

  if (!deleted) {
    throw new ApiError(404, 'Short URL not found');
  }

  return res.status(204).end();
});

module.exports = {
  createUrl,
  getUrlByShortCode,
  listUrls,
  redirectUrl,
  deleteUrl,
};
