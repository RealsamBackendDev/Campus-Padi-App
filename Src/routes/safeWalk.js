const express = require('express');
const router = express.Router();
const {
  createWalk,
  searchWalks,
  getWalkById,
  joinWalk,
  checkIn,
  getMyWalks,
  leaveWalk,
  cancelWalk,
  completeWalk,
} = require('../controllers/safeWalkController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, createWalk);
router.get('/', authenticate, searchWalks);
router.get('/my-walks', authenticate, getMyWalks);
router.get('/:id', authenticate, getWalkById);
router.post('/:id/join', authenticate, joinWalk);
router.patch('/:id/check-in', authenticate, checkIn);
router.delete('/:id/leave', authenticate, leaveWalk);
router.patch('/:id/cancel', authenticate, cancelWalk);
router.patch('/:id/complete', authenticate, completeWalk);

module.exports = router;