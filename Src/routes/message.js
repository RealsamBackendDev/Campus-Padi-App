const express = require('express');
const router = express.Router();
const { sendMessage, getMessages } = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');
const { sendSellerMessage, getSellerMessages, sendListingMessage, getListingMessages } = require('../controllers/messageController');

router.get('/request/:requestId', authenticate, getMessages);
router.post('/request/:requestId', authenticate, upload.single('file'), sendMessage);
router.get('/listing/:listingId', authenticate, getListingMessages);
router.post('/listing/:listingId', authenticate, upload.single('file'), sendListingMessage);


module.exports = router;