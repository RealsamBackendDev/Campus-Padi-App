exports.registerPrintShop = async (req, res) => {
  try {
    const { name, phone, email, school, location, address, openingTime, closingTime, pricePerPage } = req.body;

    if (!name || !phone || !school || !location) {
      return res.status(400).json({ message: 'Name, phone, school, and location are required.' });
    }

    const validSchools = ['UI', 'POLY_IBADAN', 'LEAD_CITY', 'LAUTECH'];
    if (!validSchools.includes(school)) {
      return res.status(400).json({ message: 'Invalid school.' });
    }

    const existingShop = await prisma.printShop.findUnique({ where: { phone } });
    if (existingShop) {
      return res.status(409).json({ message: 'Phone number already registered as a print shop.' });
    }

    const shop = await prisma.printShop.create({
      data: {
        name,
        phone,
        email,
        school,
        location,
        address,
        openingTime,
        closingTime,
        pricePerPage: pricePerPage || 10,
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

    res.status(201).json({ message: 'Print shop registered successfully. Pending verification.', data: shop });
  } catch (error) {
    res.status(500).json({ message: 'Error registering print shop', error: error.message });
  }
};

exports.searchPrintShops = async (req, res) => {
  try {
    const { location, includeNearby, page, limit } = req.query;
    const studentSchool = req.user?.school;
    const shouldIncludeNearby = includeNearby === 'true';

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;
    const skip = (currentPage - 1) * pageLimit;

    const where = { isVerified: true };

    if (studentSchool && !shouldIncludeNearby) {
      where.school = studentSchool;
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    const [shops, total] = await Promise.all([
      prisma.printShop.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          school: true,
          location: true,
          openingTime: true,
          closingTime: true,
          pricePerPage: true,
          rating: true,
          reviewCount: true,
        },
        orderBy: [{ rating: 'desc' }],
        skip,
        take: pageLimit,
      }),
      prisma.printShop.count({ where }),
    ]);

    res.json({
      message: 'Print shops retrieved successfully',
      data: shops,
      meta: { page: currentPage, limit: pageLimit, total, school: studentSchool, includeNearby: shouldIncludeNearby },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error searching print shops', error: error.message });
  }
};

exports.getPrintShopById = async (req, res) => {
  try {
    const { id } = req.params;

    const shop = await prisma.printShop.findUnique({
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
        pricePerPage: true,
        rating: true,
        reviewCount: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!shop) {
      return res.status(404).json({ message: 'Print shop not found.' });
    }

    res.json({ message: 'Print shop retrieved successfully', data: shop });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving print shop', error: error.message });
  }
};

exports.verifyPrintShop = async (req, res) => {
  try {
    const { id } = req.params;

    const shop = await prisma.printShop.update({
      where: { id },
      data: { isVerified: true },
      select: { id: true, name: true, phone: true, isVerified: true },
    });

    res.json({ message: 'Print shop verified successfully.', data: shop });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying print shop', error: error.message });
  }
};

exports.createPrintJob = async (req, res) => {
  try {
    const { shopId, pageCount, copies, binding, colorPrint } = req.body;
    const studentId = req.user.id;

    if (!shopId || !pageCount) {
      return res.status(400).json({ message: 'Shop ID and page count are required.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No document file provided.' });
    }

    const shop = await prisma.printShop.findUnique({ where: { id: shopId } });
    if (!shop) {
      return res.status(404).json({ message: 'Print shop not found.' });
    }

    if (!shop.isVerified) {
      return res.status(400).json({ message: 'This print shop is not verified yet.' });
    }

    const numCopies = copies || 1;
    const isBinding = binding === true || binding === 'true';
    const isColor = colorPrint === true || colorPrint === 'true';

    const pageRate = isColor ? shop.pricePerPage * 3 : shop.pricePerPage;
    let totalPrice = pageCount * numCopies * pageRate;
    if (isBinding) totalPrice += 500;

    const job = await prisma.printJob.create({
      data: {
        shopId,
        studentId,
        documentUrl: req.file.path,
        pageCount: parseInt(pageCount),
        copies: numCopies,
        binding: isBinding,
        colorPrint: isColor,
        totalPrice,
        status: 'PENDING',
      },
      select: {
        id: true,
        pageCount: true,
        copies: true,
        binding: true,
        colorPrint: true,
        totalPrice: true,
        status: true,
        createdAt: true,
        shop: { select: { name: true, phone: true, location: true } },
      },
    });

    res.status(201).json({ message: 'Print job created. The shop will confirm your order.', data: job });
  } catch (error) {
    res.status(500).json({ message: 'Error creating print job', error: error.message });
  }
};

exports.getMyPrintJobs = async (req, res) => {
  try {
    const studentId = req.user.id;

    const jobs = await prisma.printJob.findMany({
      where: { studentId },
      select: {
        id: true,
        pageCount: true,
        copies: true,
        binding: true,
        colorPrint: true,
        totalPrice: true,
        status: true,
        pickupTime: true,
        createdAt: true,
        shop: { select: { name: true, phone: true, location: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ message: 'Print jobs retrieved successfully', data: jobs });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving print jobs', error: error.message });
  }
};

exports.getShopJobs = async (req, res) => {
  try {
    const { shopId } = req.params;

    const jobs = await prisma.printJob.findMany({
      where: { shopId },
      select: {
        id: true,
        pageCount: true,
        copies: true,
        binding: true,
        colorPrint: true,
        totalPrice: true,
        status: true,
        createdAt: true,
        student: { select: { name: true, phone: true, school: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ message: 'Shop jobs retrieved successfully', data: jobs });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving shop jobs', error: error.message });
  }
};

exports.updatePrintJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, pickupTime } = req.body;

    const validStatuses = ['CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const job = await prisma.printJob.findUnique({ where: { id } });
    if (!job) {
      return res.status(404).json({ message: 'Print job not found.' });
    }

    if (status === 'CANCELLED' && job.studentId !== req.user.id) {
      return res.status(403).json({ message: 'Only the student who placed the job can cancel it.' });
    }

    const updated = await prisma.printJob.update({
      where: { id },
      data: {
        status,
        pickupTime: pickupTime ? new Date(pickupTime) : job.pickupTime,
      },
      select: {
        id: true,
        status: true,
        totalPrice: true,
        pickupTime: true,
      },
    });

    res.json({ message: `Print job ${status.toLowerCase()}.`, data: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating print job status', error: error.message });
  }
};