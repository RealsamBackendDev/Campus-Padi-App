exports.registerArtisan = async (req, res) => {
  try {
    const { name, phone, email, skills, schools, location, address, bio } = req.body;

    if (!name || !phone || !skills || !schools || !location) {
      return res.status(400).json({ message: 'Name, phone, skills, schools, and location are required.' });
    }

    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ message: 'Skills must be a non-empty array.' });
    }

    if (!Array.isArray(schools) || schools.length === 0) {
      return res.status(400).json({ message: 'Schools must be a non-empty array.' });
    }

    const validSchools = ['UI', 'POLY_IBADAN', 'LEAD_CITY', 'LAUTECH'];
    for (const school of schools) {
      if (!validSchools.includes(school)) {
        return res.status(400).json({ message: `Invalid school: ${school}` });
      }
    }

    const existingArtisan = await prisma.artisan.findUnique({ where: { phone } });
    if (existingArtisan) {
      return res.status(409).json({ message: 'Phone number already registered as an artisan.' });
    }

    const userId = req.user?.id || null;

    const artisan = await prisma.artisan.create({
      data: {
        userId,
        name,
        phone,
        email,
        skills,
        schools,
        location,
        address,
        bio,
        isVerified: false,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        skills: true,
        schools: true,
        location: true,
        isVerified: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: 'Artisan registered successfully. Pending verification.',
      data: artisan,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering artisan', error: error.message });
  }
};

exports.searchArtisans = async (req, res) => {
  try {
    const { skill, location, includeNearby, minRating, page, limit } = req.query;
    
    const studentSchool = req.user?.school;
    const shouldIncludeNearby = includeNearby === 'true';

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;
    const skip = (currentPage - 1) * pageLimit;

    const where = { isVerified: true };
    if (req.user?.id) {
  where.AND = [
    { OR: [{ userId: { not: req.user.id } }, { userId: null }] },
  ];
}

    if (studentSchool && !shouldIncludeNearby) {
      where.schools = { has: studentSchool };
    }

    if (skill) {
      where.skills = { has: skill };
    }

    if (location) {
      where.location = {
        contains: location,
        mode: 'insensitive',
      };
    }

    if (minRating) {
      where.rating = { gte: parseFloat(minRating) };
    }

    const [artisans, total] = await Promise.all([
      prisma.artisan.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          skills: true,
          schools: true,
          location: true,
          address: true,
          bio: true,
          profileImage: true,
          rating: true,
          reviewCount: true,
          createdAt: true,
        },
        orderBy: [
          { rating: 'desc' },
          { reviewCount: 'desc' },
        ],
        skip,
        take: pageLimit,
      }),
      prisma.artisan.count({ where }),
    ]);

    res.json({
      message: 'Artisans retrieved successfully',
      data: artisans,
      meta: {
        page: currentPage,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
        school: studentSchool,
        includeNearby: shouldIncludeNearby,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error searching artisans', error: error.message });
  }
};

exports.getArtisanById = async (req, res) => {
  try {
    const { id } = req.params;

    const artisan = await prisma.artisan.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        skills: true,
        schools: true,
        location: true,
        address: true,
        bio: true,
        profileImage: true,
        rating: true,
        reviewCount: true,
        isVerified: true,
        createdAt: true,
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            reviewer: {
              select: {
                name: true,
                school: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        serviceRequests: {
          where: { status: 'COMPLETED' },
          select: {
            id: true,
            category: true,
            description: true,
            completedAt: true,
          },
          take: 5,
        },
      },
    });

    if (!artisan) {
      return res.status(404).json({ message: 'Artisan not found.' });
    }

    res.json({
      message: 'Artisan retrieved successfully',
      data: artisan,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving artisan', error: error.message });
  }
};

exports.verifyArtisan = async (req, res) => {
  try {
    const { id } = req.params;

    const artisan = await prisma.artisan.update({
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
      message: 'Artisan verified successfully.',
      data: artisan,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying artisan', error: error.message });
  }
};

exports.getPendingArtisans = async (req, res) => {
  try {
    const artisans = await prisma.artisan.findMany({
      where: { isVerified: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        skills: true,
        schools: true,
        location: true,
        verificationDoc: true,
        createdAt: true,
      },
    });

    res.json({
      message: 'Pending artisans retrieved successfully',
      data: artisans,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving pending artisans', error: error.message });
  }
};

exports.uploadVerificationDoc = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'No document file provided.' });
    }

    const docUrl = req.file.path;

    const artisan = await prisma.artisan.update({
      where: { id },
      data: { verificationDoc: docUrl },
      select: {
        id: true,
        name: true,
        verificationDoc: true,
        isVerified: true,
      },
    });

    res.status(200).json({
      message: 'Verification document uploaded successfully.',
      data: artisan,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading verification document', error: error.message });
  }
};