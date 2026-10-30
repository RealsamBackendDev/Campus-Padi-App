exports.createMenuItem = async (req, res) => {
  try {
    const { vendorId, name, description, price, category, isStudentSpecial, preparationTime } = req.body;

    if (!vendorId || !name || !price || !category) {
      return res.status(400).json({ message: 'Vendor ID, name, price, and category are required.' });
    }

    if (parseFloat(price) <= 0) {
      return res.status(400).json({ message: 'Price must be greater than zero.' });
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found.' });
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        vendorId,
        name,
        description: description || null,
        price: parseFloat(price),
        category,
        imageUrl: req.file?.path || null,
        isStudentSpecial: isStudentSpecial || false,
        preparationTime: preparationTime ? parseInt(preparationTime) : null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        category: true,
        imageUrl: true,
        isStudentSpecial: true,
        preparationTime: true,
        isAvailable: true,
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Menu item created successfully.',
      data: menuItem,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating menu item', error: error.message });
  }
};

exports.getMenuItems = async (req, res) => {
  try {
    const { vendorId, category, isStudentSpecial, page, limit } = req.query;

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;
    const skip = (currentPage - 1) * pageLimit;

    const where = { isAvailable: true };

    if (vendorId) where.vendorId = vendorId;
    if (category) where.category = category;
    if (isStudentSpecial === 'true') where.isStudentSpecial = true;

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          category: true,
          imageUrl: true,
          isStudentSpecial: true,
          preparationTime: true,
          vendor: {
            select: {
              id: true,
              name: true,
              location: true,
              school: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageLimit,
      }),
      prisma.menuItem.count({ where }),
    ]);

    res.json({
      message: 'Menu items retrieved successfully',
      data: items,
      meta: {
        page: currentPage,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving menu items', error: error.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, isAvailable, isStudentSpecial, preparationTime } = req.body;

    const menuItem = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price && { price: parseFloat(price) }),
        ...(category && { category }),
        ...(isAvailable !== undefined && { isAvailable }),
        ...(isStudentSpecial !== undefined && { isStudentSpecial }),
        ...(preparationTime && { preparationTime: parseInt(preparationTime) }),
      },
      select: {
        id: true,
        name: true,
        price: true,
        category: true,
        isAvailable: true,
        isStudentSpecial: true,
      },
    });

    res.json({
      message: 'Menu item updated successfully.',
      data: menuItem,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating menu item', error: error.message });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.menuItem.delete({ where: { id } });

    res.json({ message: 'Menu item deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting menu item', error: error.message });
  }
};