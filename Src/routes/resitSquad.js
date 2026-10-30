const express = require('express');
const router = express.Router();
const {
  createSquad,
  searchSquads,
  getSquadById,
  joinSquad,
  getMySquads,
  leaveSquad,
} = require('../controllers/resitSquadController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, createSquad);
router.get('/', authenticate, searchSquads);
router.get('/my-squads', authenticate, getMySquads);
router.get('/:id', authenticate, getSquadById);
router.post('/:id/join', authenticate, joinSquad);
router.delete('/:id/leave', authenticate, leaveSquad);

module.exports = router;