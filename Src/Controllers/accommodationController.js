exports.createAccommodation = async (req, res) => {
  try {
    const { title, description, price, pricePeriod, location, address, type, amenities, landlordName, landlordPhone } = req.body;
    const listedById = req.user.id;
    const school = req.user.school;

    if (!title || !price || !location || !type || !landlordName || !landlordPhone) {
      return res.status(400).json({ message: 'Title, price, location, type, landlord name, and landlord phone are required.' });
    }

    if (parseFloat(price) <= 0) {
      return res.status(400).json({ message: 'Price must be greater than zero.' });
    }

    const validTypes = ['self_contain', 'single_room', 'shared_room', 'flat', 'hostel'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid type. Allowed: self_contain, single_room, shared_room, flat, hostel' });
    }

    const images = req.files ? req.files.map((file) => file.path) : [];

    const accommodation = await prisma.accommodation.create({
      data: {
        title,
        description: description || null,
        price: parseFloat(price),
        pricePeriod: pricePeriod || 'year',
        location,
        address: address || null,
        type,
        amenities: amenities || [],
        images,
        landlordName,
        landlordPhone,
        school,
        listedById,
        isVerified: false,
        isAvailable: true,
      },
      select: {
        id: true,
        title: true,
        price: true,
        pricePeriod: true,
        location: true,
        type: true,
        images: true,
        landlordName: true,
        landlordPhone: true,
        isVerified: true,
        isAvailable: true,
        school: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: 'Accommodation listed successfully. Pending verification.',
      data: accommodation,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error listing accommodation', error: error.message });
  }
};

exports.searchAccommodations = async (req, res) => {
  try {
    const { location, type, minPrice, maxPrice, page, limit } = req.query;
    const studentSchool = req.user?.school;

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;
    const skip = (currentPage - 1) * pageLimit;

    const where = {
      school: studentSchool,
      isVerified: true,
      isAvailable: true,
    };

    if (location) {
      where.location = {
        contains: location,
        mode: 'insensitive',
      };
    }

    if (type) where.type = type;

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    const [accommodations, total] = await Promise.all([
      prisma.accommodation.findMany({
        where,
        select: {
          id: true,
          title: true,
          price: true,
          pricePeriod: true,
          location: true,
          address: true,
          type: true,
          amenities: true,
          images: true,
          landlordName: true,
          isAvailable: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageLimit,
      }),
      prisma.accommodation.count({ where }),
    ]);

    res.json({
      message: 'Accommodations retrieved successfully',
      data: accommodations,
      meta: {
        page: currentPage,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error searching accommodations', error: error.message });
  }
};

exports.getAccommodationById = async (req, res) => {
  try {
    const { id } = req.params;

    const accommodation = await prisma.accommodation.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        pricePeriod: true,
        location: true,
        address: true,
        type: true,
        amenities: true,
        images: true,
        landlordName: true,
        landlordPhone: true,
        isVerified: true,
        isAvailable: true,
        school: true,
        createdAt: true,
        listedBy: {
          select: {
            name: true,
            phone: true,
            school: true,
          },
        },
      },
    });

    if (!accommodation) {
      return res.status(404).json({ message: 'Accommodation not found.' });
    }

    if (accommodation.school !== req.user.school && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'This accommodation is not available for your school.' });
    }

    res.json({
      message: 'Accommodation retrieved successfully',
      data: accommodation,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving accommodation', error: error.message });
  }
};

exports.getMyListings = async (req, res) => {
  try {
    const listedById = req.user.id;
    const { page, limit } = req.query;
    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;

    const [accommodations, total] = await Promise.all([
      prisma.accommodation.findMany({
        where: { listedById },
        select: {
          id: true,
          title: true,
          price: true,
          location: true,
          type: true,
          isVerified: true,
          isAvailable: true,
          createdAt: true,
          _count: {
            select: { inquiries: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (currentPage - 1) * pageLimit,
        take: pageLimit,
      }),
      prisma.accommodation.count({ where: { listedById } }),
    ]);

    res.json({
      message: 'My listings retrieved successfully',
      data: accommodations,
      meta: { page: currentPage, limit: pageLimit, total },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving my listings', error: error.message });
  }
};

exports.updateAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;
    const userId = req.user.id;

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ message: 'isAvailable must be a boolean.' });
    }

    const accommodation = await prisma.accommodation.findUnique({
      where: { id },
    });

    if (!accommodation) {
      return res.status(404).json({ message: 'Accommodation not found.' });
    }

    if (accommodation.listedById !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'You can only update your own listings.' });
    }

    const updated = await prisma.accommodation.update({
      where: { id },
      data: { isAvailable },
      select: {
        id: true,
        title: true,
        isAvailable: true,
      },
    });

    res.json({
      message: `Listing is now ${isAvailable ? 'available' : 'unavailable'}.`,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating availability', error: error.message });
  }
};

exports.deleteAccommodation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const accommodation = await prisma.accommodation.findUnique({
      where: { id },
    });

    if (!accommodation) {
      return res.status(404).json({ message: 'Accommodation not found.' });
    }

    if (accommodation.listedById !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'You can only delete your own listings.' });
    }

    await prisma.accommodation.delete({
      where: { id },
    });

    res.json({ message: 'Accommodation deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting accommodation', error: error.message });
  }
};

exports.createInquiry = async (req, res) => {
  try {
    const { accommodationId, message } = req.body;
    const studentId = req.user.id;

    if (!accommodationId) {
      return res.status(400).json({ message: 'Accommodation ID is required.' });
    }

    const accommodation = await prisma.accommodation.findUnique({
      where: { id: accommodationId },
    });

    if (!accommodation) {
      return res.status(404).json({ message: 'Accommodation not found.' });
    }

    if (!accommodation.isAvailable) {
      return res.status(400).json({ message: 'This accommodation is no longer available.' });
    }

    if (accommodation.school !== req.user.school) {
      return res.status(403).json({ message: 'This accommodation is not available for your school.' });
    }

    if (accommodation.listedById === studentId) {
      return res.status(400).json({ message: 'You cannot inquire about your own listing.' });
    }

    const existingInquiry = await prisma.accommodationInquiry.findFirst({
      where: {
        accommodationId,
        studentId,
      },
    });

    if (existingInquiry) {
      return res.status(409).json({ message: 'You have already inquired about this accommodation.' });
    }

    const inquiry = await prisma.accommodationInquiry.create({
      data: {
        accommodationId,
        studentId,
        message: message || null,
        status: 'PENDING',
      },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        accommodation: {
          select: {
            id: true,
            title: true,
            landlordName: true,
            landlordPhone: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Inquiry sent successfully. The landlord will contact you.',
      data: inquiry,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating inquiry', error: error.message });
  }
};

exports.getMyInquiries = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { page, limit } = req.query;
    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;

    const inquiries = await prisma.accommodationInquiry.findMany({
      where: { studentId },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        accommodation: {
          select: {
            id: true,
            title: true,
            price: true,
            location: true,
            type: true,
            images: true,
            landlordName: true,
            landlordPhone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * pageLimit,
      take: pageLimit,
    });

    res.json({
      message: 'My inquiries retrieved successfully',
      data: inquiries,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving inquiries', error: error.message });
  }
};

exports.getListingInquiries = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const accommodation = await prisma.accommodation.findUnique({
      where: { id },
    });

    if (!accommodation) {
      return res.status(404).json({ message: 'Accommodation not found.' });
    }

    if (accommodation.listedById !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'You can only view inquiries for your own listings.' });
    }

    const inquiries = await prisma.accommodationInquiry.findMany({
      where: { accommodationId: id },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        student: {
          select: {
            name: true,
            phone: true,
            school: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      message: 'Listing inquiries retrieved successfully',
      data: inquiries,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving listing inquiries', error: error.message });
  }
};

exports.verifyAccommodation = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;

    const accommodation = await prisma.accommodation.update({
      where: { id },
      data: { isVerified: true },
      select: {
        id: true,
        title: true,
        location: true,
        isVerified: true,
        listedBy: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    res.json({
      message: 'Accommodation verified successfully.',
      data: accommodation,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying accommodation', error: error.message });
  }
};

exports.getPendingAccommodations = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const accommodations = await prisma.accommodation.findMany({
      where: { isVerified: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        price: true,
        location: true,
        type: true,
        images: true,
        landlordName: true,
        landlordPhone: true,
        school: true,
        createdAt: true,
        listedBy: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    res.json({
      message: 'Pending accommodations retrieved successfully',
      data: accommodations,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving pending accommodations', error: error.message });
  }
};