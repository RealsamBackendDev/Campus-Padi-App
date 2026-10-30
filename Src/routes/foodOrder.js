const express = require('express');
const router = express.Router();
const {
  createFoodOrder,
  getMyFoodOrders,
  getVendorOrders,
  updateOrderStatus,
  getStudentSpecials,
} = require('../controllers/foodOrderController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, createFoodOrder);
router.get('/my-orders', authenticate, getMyFoodOrders);
router.get('/specials', authenticate, getStudentSpecials);
router.get('/vendor/:vendorId', authenticate, getVendorOrders);
router.patch('/:id/status', authenticate, updateOrderStatus);

module.exports = router;