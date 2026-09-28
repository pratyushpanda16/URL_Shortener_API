const crypto = require('crypto');
const env = require('../config/env');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateShortCode(length = env.shortCodeLength) {
  let code = '';

  for (let index = 0; index < length; index += 1) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }

  return code;
}

module.exports = {
  generateShortCode,
};
