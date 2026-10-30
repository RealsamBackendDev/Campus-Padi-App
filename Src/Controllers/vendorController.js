exports.registerVendor = async (req, res) => {
  try {
    const { name, phone, email, school, location, address, openingTime, closingTime } = req.body;

    if (!name || !phone || !school || !location) {
      return res.status(400).json({ message: 'Name, phone, school, and location are required.' });
    }

    const validSchools = ['UI', 'POLY_IBADAN', 'LEAD_CITY', 'LAUTECH'];
    if (!validSchools.includes(school)) {
      return res.status(400).json({ message: 'Invalid school.' });
    }

    const existingVendor = await prisma.vendor.findUnique({ where: { phone } });
    if (existingVendor) {
      return res.status(409).json({ message: 'Phone number already registered as a vendor.' });
    }

    const vendor = await prisma.vendor.create({
      data: {
        name,
        phone,
        email,
        school,
        location,
        address,
        openingTime,
        closingTime,
        isVerified: false,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        school: true,
        location: true,
        isVerified: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: 'Vendor registered successfully. Pending verification.',
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering vendor', error: error.message });
  }
};

exports.getVendors = async (req, res) => {
  try {
    const { location, page, limit } = req.query;
    const studentSchool = req.user?.school;

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;
    const skip = (currentPage - 1) * pageLimit;

    const where = {
      school: studentSchool,
      isVerified: true,
      isOpen: true,
    };

    if (location) {
      where.location = {
        contains: location,
        mode: 'insensitive',
      };
    }

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          school: true,
          location: true,
          address: true,
          openingTime: true,
          closingTime: true,
          logoUrl: true,
          rating: true,
          reviewCount: true,
          createdAt: true,
        },
        orderBy: { rating: 'desc' },
        skip,
        take: pageLimit,
      }),
      prisma.vendor.count({ where }),
    ]);

    res.json({
      message: 'Vendors retrieved successfully',
      data: vendors,
      meta: {
        page: currentPage,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving vendors', error: error.message });
  }
};

exports.getVendorById = async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        school: true,
        location: true,
        address: true,
        openingTime: true,
        closingTime: true,
        logoUrl: true,
        rating: true,
        reviewCount: true,
        isOpen: true,
        createdAt: true,
        menuItems: {
          where: { isAvailable: true },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            category: true,
            imageUrl: true,
            isStudentSpecial: true,
            preparationTime: true,
          },
        },
      },
    });

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found.' });
    }

    if (vendor.school !== req.user.school && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'This vendor is not available for your school.' });
    }

    res.json({
      message: 'Vendor retrieved successfully',
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving vendor', error: error.message });
  }
};

exports.verifyVendor = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;

    const vendor = await prisma.vendor.update({
      where: { id },
      data: { isVerified: true },
      select: {
        id: true,
        name: true,
        phone: true,
        isVerified: true,
      },
    });

    res.json({
      message: 'Vendor verified successfully.',
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying vendor', error: error.message });
  }
};

exports.toggleOpenStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isOpen } = req.body;

    if (typeof isOpen !== 'boolean') {
      return res.status(400).json({ message: 'isOpen must be a boolean.' });
    }

    const vendor = await prisma.vendor.update({
      where: { id },
      data: { isOpen },
      select: {
        id: true,
        name: true,
        isOpen: true,
      },
    });

    res.json({
      message: `Vendor is now ${isOpen ? 'open' : 'closed'}.`,
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating vendor status', error: error.message });
  }
};