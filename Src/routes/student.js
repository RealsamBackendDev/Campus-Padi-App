const express = require('express');
const router = express.Router();
const { upload } = require('../utils/cloudinary');
const {
  updateProfile,
  uploadProfileImage,
  getMyStats,
  getMyReviews,
  getStudentById,
} = require('../controllers/studentController');
const { authenticate } = require('../middleware/auth');

router.patch('/profile', authenticate, updateProfile);
router.post('/profile-image', authenticate, upload.single('image'), uploadProfileImage);
router.get('/stats', authenticate, getMyStats);
router.get('/reviews', authenticate, getMyReviews);
router.get('/:id', authenticate, getStudentById);

module.exports = router;