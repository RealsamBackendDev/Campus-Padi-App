const express = require('express');
const router = express.Router();
const {
  createPool,
  searchPools,
  getPoolById,
  joinPool,
  getMyPools,
  leavePool,
  cancelPool,
} = require('../controllers/ridePoolController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, createPool);
router.get('/', authenticate, searchPools);
router.get('/my-pools', authenticate, getMyPools);
router.get('/:id', authenticate, getPoolById);
router.post('/:id/join', authenticate, joinPool);
router.delete('/:id/leave', authenticate, leavePool);
router.patch('/:id/cancel', authenticate, cancelPool);

module.exports = router;