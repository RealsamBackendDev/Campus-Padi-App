const express = require('express');
const router = express.Router();
const { upload } = require('../utils/cloudinary');
const {
  uploadMaterial,
  searchMaterials,
  getMaterialById,
  downloadMaterial,
  getMyMaterials,
  approveMaterial,
  getPendingMaterials,
  deleteMaterial,
} = require('../controllers/materialController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, upload.single('file'), uploadMaterial);
router.get('/', authenticate, searchMaterials);
router.get('/my-materials', authenticate, getMyMaterials);
router.get('/pending', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), getPendingMaterials);
router.get('/:id', authenticate, getMaterialById);
router.get('/:id/download', authenticate, downloadMaterial);
router.patch('/:id/approve', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), approveMaterial);
router.delete('/:id', authenticate, deleteMaterial);

module.exports = router;