const express = require('express');
const { createUrl, redirectUrl } = require('../controllers/url.controller');

const router = express.Router();
const redirectRouter = express.Router();

router.post('/', createUrl);
redirectRouter.get('/:shortCode', redirectUrl);

module.exports = router;
module.exports.redirectRouter = redirectRouter;
