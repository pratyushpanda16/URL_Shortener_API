const mongoose = require('mongoose');

const urlSchema = new mongoose.Schema(
  {
    originalUrl: {
      type: String,
      required: [true, 'originalUrl is required'],
      trim: true,
      validate: {
        validator(value) {
          try {
            const parsed = new URL(value);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
          } catch {
            return false;
          }
        },
        message: 'originalUrl must be a valid HTTP or HTTPS URL',
      },
    },
    shortCode: {
      type: String,
      required: [true, 'shortCode is required'],
      unique: true,
      trim: true,
      minlength: [4, 'shortCode must be at least 4 characters'],
      maxlength: [10, 'shortCode must be at most 10 characters'],
      match: [/^[A-Za-z0-9]+$/, 'shortCode must be alphanumeric'],
    },
    clicks: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

urlSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Url', urlSchema);
