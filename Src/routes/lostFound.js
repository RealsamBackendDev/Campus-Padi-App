const express = require('express');
const router = express.Router();
const {
  createItem,
  getItems,
  getMyItems,
  updateStatus,
  deleteItem,
} = require('../controllers/lostFoundController');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');

router.post('/', authenticate, upload.single('image'), createItem);
router.get('/', authenticate, getItems);
router.get('/my-items', authenticate, getMyItems);
router.patch('/:id/status', authenticate, updateStatus);
router.delete('/:id', authenticate, deleteItem);

module.exports = router;