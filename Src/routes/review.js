const express = require('express');
const router = express.Router();
const { createReview, getArtisanReviews } = require('../controllers/reviewController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, createReview);
router.get('/artisan/:artisanId', authenticate, getArtisanReviews);

module.exports = router;