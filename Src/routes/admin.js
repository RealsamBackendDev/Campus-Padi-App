const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllStudents,
  getAllArtisans,
  verifyArtisan,
  rejectArtisan,
  deleteUser,
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/dashboard', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), getDashboardStats);
router.get('/students', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), getAllStudents);
router.get('/artisans', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), getAllArtisans);
router.patch('/artisans/:id/verify', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), verifyArtisan);
router.patch('/artisans/:id/reject', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), rejectArtisan);
router.delete('/users/:id', authenticate, authorize('SUPER_ADMIN'), deleteUser);

module.exports = router;