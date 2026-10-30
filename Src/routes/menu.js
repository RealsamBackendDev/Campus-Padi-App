const express = require('express');
const router = express.Router();
const { upload } = require('../utils/cloudinary');
const {
  createMenuItem,
  getMenuItems,
  updateMenuItem,
  deleteMenuItem,
} = require('../controllers/menuController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, upload.single('image'), createMenuItem);
router.get('/', authenticate, getMenuItems);
router.patch('/:id', authenticate, updateMenuItem);
router.delete('/:id', authenticate, deleteMenuItem);

module.exports = router;