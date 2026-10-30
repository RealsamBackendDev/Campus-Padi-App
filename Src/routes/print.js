const express = require('express');
const router = express.Router();
const { upload } = require('../utils/cloudinary');
const {
  registerPrintShop,
  searchPrintShops,
  getPrintShopById,
  verifyPrintShop,
  createPrintJob,
  getMyPrintJobs,
  getShopJobs,
  updatePrintJobStatus,
  getPendingPrintShops
} = require('../controllers/printController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', registerPrintShop);
router.get('/', authenticate, searchPrintShops);
router.get('/admin/pending', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), getPendingPrintShops);
router.get('/:id', authenticate, getPrintShopById);
router.patch('/:id/verify', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), verifyPrintShop);
router.post('/jobs', authenticate, upload.single('document'), createPrintJob);
router.get('/jobs/my', authenticate, getMyPrintJobs);
router.get('/:shopId/jobs', authenticate, getShopJobs);
router.patch('/jobs/:id/status', authenticate, updatePrintJobStatus);

module.exports = router;