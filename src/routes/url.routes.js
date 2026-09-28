const express = require('express');
const { createUrl } = require('../controllers/url.controller');

const router = express.Router();

router.post('/', createUrl);

module.exports = router;
