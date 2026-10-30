const express = require('express');
const router = express.Router();
const { upload } = require('../utils/cloudinary');
const {
  registerArtisan,
  searchArtisans,
  getArtisanById,
  verifyArtisan,
  getPendingArtisans,
  uploadVerificationDoc,
} = require('../controllers/artisanController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, searchArtisans);
router.get('/:id', authenticate, getArtisanById);
router.post('/', authenticate, registerArtisan);
router.post('/:id/verify-doc', authenticate, upload.single('document'), uploadVerificationDoc);
router.get('/admin/pending', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), getPendingArtisans);
router.patch('/:id/verify', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), verifyArtisan);

module.exports = router;