const express = require('express');
const router = express.Router();
const {
  createProject,
  searchProjects,
  getProjectById,
  applyToProject,
  respondToApplication,
  getMyProjects,
  getMyApplications,
  closeProject,
  completeProject,
} = require('../controllers/groupProjectController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, createProject);
router.get('/', authenticate, searchProjects);
router.get('/my-projects', authenticate, getMyProjects);
router.get('/my-applications', authenticate, getMyApplications);
router.get('/:id', authenticate, getProjectById);
router.post('/apply', authenticate, applyToProject);
router.patch('/applications/:applicationId/respond', authenticate, respondToApplication);
router.patch('/:id/close', authenticate, closeProject);
router.patch('/:id/complete', authenticate, completeProject);

module.exports = router;