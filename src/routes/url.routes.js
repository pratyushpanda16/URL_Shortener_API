const express = require('express');
const {
  createUrl,
  getUrlByShortCode,
  redirectUrl,
  deleteUrl,
} = require('../controllers/url.controller');

const router = express.Router();
const redirectRouter = express.Router();

router.post('/', createUrl);
router.get('/:shortCode', getUrlByShortCode);
router.delete('/:shortCode', deleteUrl);
redirectRouter.get('/:shortCode', redirectUrl);

module.exports = router;
module.exports.redirectRouter = redirectRouter;
