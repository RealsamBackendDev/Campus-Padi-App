const express = require('express');
const router = express.Router();
const {
  registerVendor,
  getVendors,
  getVendorById,
  verifyVendor,
  getPendingVendors,
  toggleOpenStatus,
} = require('../controllers/vendorController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', registerVendor);
router.get('/', authenticate, getVendors);
router.get('/admin/pending', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), getPendingVendors);
router.get('/:id', authenticate, getVendorById);
router.patch('/:id/verify', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), verifyVendor);
router.patch('/:id/toggle-open', authenticate, toggleOpenStatus);

module.exports = router;