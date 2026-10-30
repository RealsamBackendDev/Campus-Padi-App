const express = require('express');
const router = express.Router();
const { upload } = require('../utils/cloudinary');
const {
  createAccommodation,
  searchAccommodations,
  getAccommodationById,
  getMyListings,
  updateAvailability,
  deleteAccommodation,
  createInquiry,
  getMyInquiries,
  getListingInquiries,
  verifyAccommodation,
  getPendingAccommodations,
} = require('../controllers/accommodationController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, upload.array('images', 5), createAccommodation);
router.get('/', authenticate, searchAccommodations);
router.get('/my-listings', authenticate, getMyListings);
router.get('/pending', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), getPendingAccommodations);
router.get('/:id', authenticate, getAccommodationById);
router.patch('/:id/availability', authenticate, updateAvailability);
router.delete('/:id', authenticate, deleteAccommodation);
router.post('/inquiry', authenticate, createInquiry);
router.get('/my-inquiries', authenticate, getMyInquiries);
router.get('/:id/inquiries', authenticate, getListingInquiries);
router.patch('/:id/verify', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), verifyAccommodation);

module.exports = router;