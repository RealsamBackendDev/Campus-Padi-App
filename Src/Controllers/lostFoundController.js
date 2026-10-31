exports.createItem = async (req, res) => {
  try {
    const { type, title, description, location, contactPhone } = req.body;
    const userId = req.user.id;
    const school = req.user.school;

    if (!type || !title || !location || !contactPhone) {
      return res.status(400).json({ message: 'Type, title, location, and contact phone are required.' });
    }

    if (!['LOST', 'FOUND'].includes(type)) {
      return res.status(400).json({ message: 'Type must be LOST or FOUND.' });
    }

    const item = await prisma.lostFoundItem.create({
      data: {
        school,
        type,
        title,
        description: description || null,
        location,
        contactPhone,
        imageUrl: req.file ? req.file.path : null,
        status: 'OPEN',
        userId,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    res.status(201).json({ message: 'Item reported successfully', data: item });
  } catch (error) {
    res.status(500).json({ message: 'Error reporting item', error: error.message });
  }
};

exports.getItems = async (req, res) => {
  try {
    const { type, search } = req.query;
    const school = req.user?.school;

    const where = { school, status: 'OPEN' };

    if (type && ['LOST', 'FOUND'].includes(type)) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.lostFoundItem.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ message: 'Items retrieved successfully', data: items });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving items', error: error.message });
  }
};

exports.getMyItems = async (req, res) => {
  try {
    const items = await prisma.lostFoundItem.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ message: 'Your items retrieved successfully', data: items });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving your items', error: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!['OPEN', 'CLAIMED', 'CLOSED'].includes(status)) {
      return res.status(400).json({ message: 'Status must be OPEN, CLAIMED, or CLOSED.' });
    }

    const item = await prisma.lostFoundItem.findFirst({ where: { id, userId } });
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const updated = await prisma.lostFoundItem.update({
      where: { id },
      data: { status },
    });

    res.json({ message: `Item marked as ${status.toLowerCase()}`, data: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating item', error: error.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const item = await prisma.lostFoundItem.findFirst({ where: { id, userId } });
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    await prisma.lostFoundItem.delete({ where: { id } });
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting item', error: error.message });
  }
};