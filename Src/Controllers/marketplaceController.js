const CONDITIONS = ['NEW', 'USED', 'FAIRLY_USED'];
const STATUSES = ['AVAILABLE', 'RESERVED', 'SOLD'];

exports.createListing = async (req, res) => {
  try {
    const { title, description, price, category, condition, location, contactPhone } = req.body;
    const userId = req.user.id;
    const school = req.user.school;

    if (!title || !price || !category || !condition || !location || !contactPhone) {
      return res.status(400).json({ message: 'Title, price, category, condition, location, and contact phone are required.' });
    }

    if (!CONDITIONS.includes(condition)) {
      return res.status(400).json({ message: 'Condition must be NEW, USED, or FAIRLY_USED.' });
    }

    const amount = Number(price);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Price must be a positive number.' });
    }

    const listing = await prisma.marketplaceListing.create({
      data: {
        school,
        title,
        description: description || null,
        price: amount,
        category,
        condition,
        location,
        contactPhone,
        imageUrl: req.file ? req.file.path : null,
        status: 'AVAILABLE',
        userId,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    res.status(201).json({ message: 'Listing created successfully', data: listing });
  } catch (error) {
    res.status(500).json({ message: 'Error creating listing', error: error.message });
  }
};

exports.getListings = async (req, res) => {
  try {
    const { category, condition, search, maxPrice } = req.query;
    const school = req.user?.school;

    const where = { school, status: { in: ['AVAILABLE', 'RESERVED'] } };

    if (category) where.category = category;
    if (condition && CONDITIONS.includes(condition)) where.condition = condition;
    if (maxPrice) where.price = { lte: Number(maxPrice) };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const listings = await prisma.marketplaceListing.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ message: 'Listings retrieved successfully', data: listings });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving listings', error: error.message });
  }
};

exports.getMyListings = async (req, res) => {
  try {
    const listings = await prisma.marketplaceListing.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ message: 'Your listings retrieved successfully', data: listings });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving your listings', error: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Status must be AVAILABLE, RESERVED, or SOLD.' });
    }

    const listing = await prisma.marketplaceListing.findFirst({ where: { id, userId } });
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const updated = await prisma.marketplaceListing.update({
      where: { id },
      data: { status },
    });

    res.json({ message: `Listing marked as ${status.toLowerCase()}`, data: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating listing', error: error.message });
  }
};

exports.deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const listing = await prisma.marketplaceListing.findFirst({ where: { id, userId } });
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    await prisma.marketplaceListing.delete({ where: { id } });
    res.json({ message: 'Listing deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting listing', error: error.message });
  }
};