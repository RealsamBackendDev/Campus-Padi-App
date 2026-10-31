const express = require('express');
const router = express.Router();
const {
  createListing,
  getListings,
  getMyListings,
  updateStatus,
  deleteListing,
} = require('../controllers/marketplaceController');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');

router.post('/', authenticate, upload.single('image'), createListing);
router.get('/', authenticate, getListings);
router.get('/my-listings', authenticate, getMyListings);
router.patch('/:id/status', authenticate, updateStatus);
router.delete('/:id', authenticate, deleteListing);

module.exports = router;