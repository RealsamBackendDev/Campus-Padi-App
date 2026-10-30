const express = require('express');
const router = express.Router();
const { sendMessage, getMessages } = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');

router.get('/request/:requestId', authenticate, getMessages);
router.post('/request/:requestId', authenticate, upload.single('file'), sendMessage);

module.exports = router;