exports.registerAsTutor = async (req, res) => {
  try {
    const { courses, rate, bio } = req.body;
    const userId = req.user.id;

    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({ message: 'Courses must be a non-empty array.' });
    }

    if (rate && parseFloat(rate) < 0) {
      return res.status(400).json({ message: 'Rate cannot be negative.' });
    }

    const existingTutor = await prisma.tutor.findUnique({
      where: { userId },
    });

    if (existingTutor) {
      return res.status(409).json({ message: 'You are already registered as a tutor.' });
    }

    const tutor = await prisma.tutor.create({
      data: {
        userId,
        courses: courses.map((c) => c.toUpperCase()),
        rate: parseFloat(rate) || 0,
        bio: bio || null,
        isVerified: false,
      },
      select: {
        id: true,
        courses: true,
        rate: true,
        bio: true,
        isVerified: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            school: true,
            department: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Tutor registration submitted. Pending verification.',
      data: tutor,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering as tutor', error: error.message });
  }
};

exports.searchTutors = async (req, res) => {
  try {
    const { course, page, limit } = req.query;
    const studentSchool = req.user?.school;

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;
    const skip = (currentPage - 1) * pageLimit;

    const where = {
      isVerified: true,
      user: {
        school: studentSchool,
      },
    };

    if (course) {
      where.courses = {
        has: course.toUpperCase(),
      };
    }

    const [tutors, total] = await Promise.all([
      prisma.tutor.findMany({
        where,
        select: {
          id: true,
          courses: true,
          rate: true,
          bio: true,
          rating: true,
          reviewCount: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              school: true,
              department: true,
              profileImage: true,
            },
          },
        },
        orderBy: { rating: 'desc' },
        skip,
        take: pageLimit,
      }),
      prisma.tutor.count({ where }),
    ]);

    res.json({
      message: 'Tutors retrieved successfully',
      data: tutors,
      meta: {
        page: currentPage,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error searching tutors', error: error.message });
  }
};

exports.getTutorById = async (req, res) => {
  try {
    const { id } = req.params;

    const tutor = await prisma.tutor.findUnique({
      where: { id },
      select: {
        id: true,
        courses: true,
        rate: true,
        bio: true,
        rating: true,
        reviewCount: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            school: true,
            department: true,
            profileImage: true,
          },
        },
      },
    });

    if (!tutor) {
      return res.status(404).json({ message: 'Tutor not found.' });
    }

    if (tutor.user.school !== req.user.school && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'This tutor is not available for your school.' });
    }

    res.json({
      message: 'Tutor retrieved successfully',
      data: tutor,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving tutor', error: error.message });
  }
};

exports.bookSession = async (req, res) => {
  try {
    const { tutorId, courseCode, scheduledAt, duration, location, notes } = req.body;
    const studentId = req.user.id;

    if (!tutorId || !courseCode || !scheduledAt || !duration) {
      return res.status(400).json({ message: 'Tutor ID, course code, scheduled time, and duration are required.' });
    }

    const tutor = await prisma.tutor.findUnique({
      where: { id: tutorId },
      include: { user: true },
    });

    if (!tutor) {
      return res.status(404).json({ message: 'Tutor not found.' });
    }

    if (!tutor.isVerified) {
      return res.status(400).json({ message: 'This tutor is not yet verified.' });
    }

    if (tutor.user.school !== req.user.school) {
      return res.status(403).json({ message: 'This tutor is not available for your school.' });
    }

    if (tutor.userId === studentId) {
      return res.status(400).json({ message: 'You cannot book a session with yourself.' });
    }

    const price = tutor.rate * parseInt(duration);

    const session = await prisma.tutorSession.create({
      data: {
        tutorId,
        studentId,
        courseCode: courseCode.toUpperCase(),
        scheduledAt: new Date(scheduledAt),
        duration: parseInt(duration),
        price,
        location: location || null,
        notes: notes || null,
        status: 'PENDING',
      },
      select: {
        id: true,
        courseCode: true,
        status: true,
        scheduledAt: true,
        duration: true,
        price: true,
        location: true,
        notes: true,
        createdAt: true,
        tutor: {
          select: {
            user: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      message: 'Session booked successfully. Pending tutor confirmation.',
      data: session,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error booking session', error: error.message });
  }
};

exports.getMySessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page, limit } = req.query;
    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;

    const where = { studentId: userId };
    if (status) where.status = status;

    const sessions = await prisma.tutorSession.findMany({
      where,
      select: {
        id: true,
        courseCode: true,
        status: true,
        scheduledAt: true,
        duration: true,
        price: true,
        location: true,
        notes: true,
        createdAt: true,
        tutor: {
          select: {
            user: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'desc' },
      skip: (currentPage - 1) * pageLimit,
      take: pageLimit,
    });

    res.json({
      message: 'My sessions retrieved successfully',
      data: sessions,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving my sessions', error: error.message });
  }
};

exports.getTutorSessions = async (req, res) => {
  try {
    const tutor = await prisma.tutor.findFirst({
      where: { userId: req.user.id },
    });

    if (!tutor) {
      return res.status(403).json({ message: 'You are not registered as a tutor.' });
    }

    const { status, page, limit } = req.query;
    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;

    const where = { tutorId: tutor.id };
    if (status) where.status = status;

    const sessions = await prisma.tutorSession.findMany({
      where,
      select: {
        id: true,
        courseCode: true,
        status: true,
        scheduledAt: true,
        duration: true,
        price: true,
        location: true,
        notes: true,
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
      orderBy: { scheduledAt: 'desc' },
      skip: (currentPage - 1) * pageLimit,
      take: pageLimit,
    });

    res.json({
      message: 'Tutor sessions retrieved successfully',
      data: sessions,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving tutor sessions', error: error.message });
  }
};

exports.confirmSession = async (req, res) => {
  try {
    const { id } = req.params;
    const tutor = await prisma.tutor.findFirst({
      where: { userId: req.user.id },
    });

    const session = await prisma.tutorSession.findFirst({
      where: { id, tutorId: tutor?.id },
    });

    if (!session) {
      return res.status(403).json({ message: 'You can only confirm your own sessions.' });
    }

    const updated = await prisma.tutorSession.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      select: {
        id: true,
        status: true,
        student: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    res.json({
      message: 'Session confirmed.',
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error confirming session', error: error.message });
  }
};

exports.completeSession = async (req, res) => {
  try {
    const { id } = req.params;
    const tutor = await prisma.tutor.findFirst({
      where: { userId: req.user.id },
    });

    const session = await prisma.tutorSession.findFirst({
      where: { id, tutorId: tutor?.id },
    });

    if (!session) {
      return res.status(403).json({ message: 'You can only complete your own sessions.' });
    }

    const updated = await prisma.tutorSession.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    res.json({
      message: 'Session marked as completed.',
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error completing session', error: error.message });
  }
};

exports.cancelSession = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const session = await prisma.tutorSession.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    if (session.studentId !== userId && session.tutorId !== userId) {
      return res.status(403).json({ message: 'You can only cancel your own sessions.' });
    }

    const updated = await prisma.tutorSession.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({
      message: 'Session cancelled.',
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling session', error: error.message });
  }
};

exports.verifyTutor = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;

    const tutor = await prisma.tutor.update({
      where: { id },
      data: { isVerified: true },
      select: {
        id: true,
        courses: true,
        rate: true,
        isVerified: true,
        user: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    res.json({
      message: 'Tutor verified successfully.',
      data: tutor,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying tutor', error: error.message });
  }
};

exports.getPendingTutors = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const tutors = await prisma.tutor.findMany({
      where: { isVerified: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        courses: true,
        rate: true,
        bio: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            phone: true,
            school: true,
            department: true,
          },
        },
      },
    });

    res.json({
      message: 'Pending tutors retrieved successfully',
      data: tutors,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving pending tutors', error: error.message });
  }
};