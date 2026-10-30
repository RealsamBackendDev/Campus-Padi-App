const express = require('express');
const router = express.Router();
const {
  registerAsTutor,
  searchTutors,
  getTutorById,
  bookSession,
  getMySessions,
  getTutorSessions,
  confirmSession,
  completeSession,
  cancelSession,
  verifyTutor,
  getPendingTutors,
} = require('../controllers/tutorController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/register', authenticate, registerAsTutor);
router.get('/', authenticate, searchTutors);
router.get('/pending', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), getPendingTutors);
router.get('/:id', authenticate, getTutorById);
router.post('/book', authenticate, bookSession);
router.get('/sessions/my', authenticate, getMySessions);
router.get('/sessions/tutor', authenticate, getTutorSessions);
router.patch('/sessions/:id/confirm', authenticate, confirmSession);
router.patch('/sessions/:id/complete', authenticate, completeSession);
router.patch('/sessions/:id/cancel', authenticate, cancelSession);
router.patch('/:id/verify', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), verifyTutor);

module.exports = router;