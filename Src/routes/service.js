const express = require('express');
const router = express.Router();
const {
  createServiceRequest,
  getMyRequests,
  getArtisanRequests,
  acceptRequest,
  startWork,
  completeRequest,
  cancelRequest,
  getRequestById,
} = require('../controllers/serviceController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, createServiceRequest);
router.get('/my-requests', authenticate, getMyRequests);
router.get('/:id', authenticate, getRequestById);
router.patch('/:id/cancel', authenticate, cancelRequest);
router.get('/artisan/requests', authenticate, getArtisanRequests);
router.patch('/:id/accept', authenticate, acceptRequest);
router.patch('/:id/start', authenticate, startWork);
router.patch('/:id/complete', authenticate, completeRequest);

module.exports = router;