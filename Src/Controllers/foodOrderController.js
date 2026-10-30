exports.createFoodOrder = async (req, res) => {
  try {
    const { vendorId, items, pickupLocation, notes, deliveryFee } = req.body;
    const studentId = req.user.id;

    if (!vendorId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Vendor ID and at least one item are required.' });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found.' });
    }

    if (!vendor.isOpen) {
      return res.status(400).json({ message: 'This vendor is currently closed.' });
    }

    if (vendor.school !== req.user.school) {
      return res.status(403).json({ message: 'This vendor is not available for your school.' });
    }

    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of items) {
      const { menuItemId, quantity } = item;

      if (!menuItemId || !quantity || quantity < 1) {
        return res.status(400).json({ message: 'Each item must have a menuItemId and quantity >= 1.' });
      }

      const menuItem = await prisma.menuItem.findUnique({
        where: { id: menuItemId },
      });

      if (!menuItem || !menuItem.isAvailable) {
        return res.status(404).json({ message: `Menu item ${menuItemId} not found or unavailable.` });
      }

      if (menuItem.vendorId !== vendorId) {
        return res.status(400).json({ message: 'All items must belong to the same vendor.' });
      }

      const subtotal = menuItem.price * quantity;
      totalAmount += subtotal;

      orderItemsData.push({
        menuItemId,
        quantity,
        unitPrice: menuItem.price,
        subtotal,
      });
    }

    const order = await prisma.foodOrder.create({
      data: {
        studentId,
        vendorId,
        totalAmount,
        pickupLocation: pickupLocation || null,
        notes: notes || null,
        deliveryFee: deliveryFee || 0,
        status: 'PENDING',
        items: {
          create: orderItemsData,
        },
      },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        pickupLocation: true,
        notes: true,
        deliveryFee: true,
        createdAt: true,
        vendor: {
          select: {
            id: true,
            name: true,
            phone: true,
            location: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            menuItem: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      message: 'Food order placed successfully.',
      data: order,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error placing food order', error: error.message });
  }
};

exports.getMyFoodOrders = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { status, page, limit } = req.query;

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;

    const where = { studentId };
    if (status) where.status = status;

    const orders = await prisma.foodOrder.findMany({
      where,
      select: {
        id: true,
        status: true,
        totalAmount: true,
        pickupLocation: true,
        deliveryFee: true,
        createdAt: true,
        vendor: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        items: {
          select: {
            quantity: true,
            subtotal: true,
            menuItem: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * pageLimit,
      take: pageLimit,
    });

    res.json({
      message: 'Food orders retrieved successfully',
      data: orders,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving food orders', error: error.message });
  }
};

exports.getVendorOrders = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { status, page, limit } = req.query;

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;

    const where = { vendorId };
    if (status) where.status = status;

    const orders = await prisma.foodOrder.findMany({
      where,
      select: {
        id: true,
        status: true,
        totalAmount: true,
        pickupLocation: true,
        notes: true,
        createdAt: true,
        student: {
          select: {
            name: true,
            phone: true,
          },
        },
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            subtotal: true,
            menuItem: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * pageLimit,
      take: pageLimit,
    });

    res.json({
      message: 'Vendor orders retrieved successfully',
      data: orders,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving vendor orders', error: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const order = await prisma.foodOrder.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        student: {
          select: {
            name: true,
            phone: true,
          },
        },
        vendor: {
          select: {
            name: true,
          },
        },
      },
    });

    res.json({
      message: `Order status updated to ${status}.`,
      data: order,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};

exports.getStudentSpecials = async (req, res) => {
  try {
    const studentSchool = req.user?.school;

    const items = await prisma.menuItem.findMany({
      where: {
        isStudentSpecial: true,
        isAvailable: true,
        vendor: {
          school: studentSchool,
          isVerified: true,
          isOpen: true,
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        category: true,
        imageUrl: true,
        preparationTime: true,
        vendor: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
      orderBy: { price: 'asc' },
      take: 50,
    });

    res.json({
      message: 'Student specials retrieved successfully',
      data: items,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving student specials', error: error.message });
  }
};