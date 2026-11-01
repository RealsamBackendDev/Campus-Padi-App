const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  uploadDocument,
  getDocuments,
  searchDocuments,
  deleteDocument,
  askQuestion,
  getQueryHistory,
} = require('../controllers/studyController');
const { authenticate } = require('../middleware/auth');

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/documents', authenticate, memUpload.single('file'), uploadDocument);
router.get('/documents', authenticate, getDocuments);
router.get('/search', authenticate, searchDocuments);
router.delete('/documents/:id', authenticate, deleteDocument);
router.post('/ask', authenticate, askQuestion);
router.get('/history', authenticate, getQueryHistory);

module.exports = router;