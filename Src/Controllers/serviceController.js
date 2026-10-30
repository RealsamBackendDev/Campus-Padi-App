exports.createServiceRequest = async (req, res) => {
  try {
    const { category, description, location, budget, scheduledAt } = req.body;
    const studentId = req.user.id;
    const school = req.user.school;

    if (!category || !description || !location) {
      return res.status(400).json({ message: 'Category, description, and location are required.' });
    }

    if (description.length < 10) {
      return res.status(400).json({ message: 'Description must be at least 10 characters.' });
    }

    const request = await prisma.serviceRequest.create({
      data: {
        studentId,
        school,
        category,
        description,
        location,
        budget: budget || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: 'PENDING',
      },
      select: {
        id: true,
        school: true,
        category: true,
        description: true,
        location: true,
        budget: true,
        status: true,
        createdAt: true,
        student: {
          select: {
            name: true,
            phone: true,
            school: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Service request created. Artisans will be notified.',
      data: request,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating service request', error: error.message });
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { status, page, limit } = req.query;

    const where = { studentId };
    if (status) where.status = status;

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;

    const requests = await prisma.serviceRequest.findMany({
      where,
      select: {
        id: true,
        category: true,
        description: true,
        location: true,
        status: true,
        price: true,
        createdAt: true,
        artisan: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        review: {
          select: {
            id: true,
            rating: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * pageLimit,
      take: pageLimit,
    });

    res.json({
      message: 'Requests retrieved successfully',
      data: requests,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving requests', error: error.message });
  }
};

exports.getArtisanRequests = async (req, res) => {
  try {
    const artisan = await prisma.artisan.findFirst({
      where: { userId: req.user.id },
    });

    if (!artisan) {
      return res.status(403).json({ message: 'You are not registered as an artisan.' });
    }
    
    if (!artisan.isVerified) {
  return res.status(403).json({ message: 'Your artisan profile is pending verification.' });
}

    const { status, page, limit } = req.query;
    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;

    const where = {
      school: { in: artisan.schools },
    };

    if (status) {
      where.status = status;
    } else {
      where.status = { in: ['PENDING', 'ACCEPTED'] };
    }

    where.OR = [
      { artisanId: artisan.id },
      { artisanId: null },
    ];

    const requests = await prisma.serviceRequest.findMany({
      where,
      select: {
        id: true,
        school: true,
        category: true,
        description: true,
        location: true,
        budget: true,
        status: true,
        createdAt: true,
        student: {
          select: {
            name: true,
            phone: true,
            school: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * pageLimit,
      take: pageLimit,
    });

    res.json({
      message: 'Artisan requests retrieved successfully',
      data: requests,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving artisan requests', error: error.message });
  }
};

exports.acceptRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const artisan = await prisma.artisan.findFirst({
      where: { userId: req.user.id },
    });

    if (!artisan) {
      return res.status(403).json({ message: 'You are not registered as an artisan.' });
    }

    const request = await prisma.serviceRequest.update({
      where: { id },
      data: {
        artisanId: artisan.id,
        status: 'ACCEPTED',
      },
      select: {
        id: true,
        status: true,
        artisanId: true,
        student: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    res.json({
      message: 'Request accepted. Contact the student to arrange details.',
      data: request,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting request', error: error.message });
  }
};

exports.startWork = async (req, res) => {
  try {
    const { id } = req.params;
    const artisan = await prisma.artisan.findFirst({
      where: { userId: req.user.id },
    });

    const request = await prisma.serviceRequest.findFirst({
      where: { id, artisanId: artisan?.id },
    });

    if (!request) {
      return res.status(403).json({ message: 'You can only update your own requests.' });
    }

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });

    res.json({
      message: 'Work started.',
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error starting work', error: error.message });
  }
};

exports.completeRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;
    const artisan = await prisma.artisan.findFirst({
      where: { userId: req.user.id },
    });

    const request = await prisma.serviceRequest.findFirst({
      where: { id, artisanId: artisan?.id },
    });

    if (!request) {
      return res.status(403).json({ message: 'You can only complete your own requests.' });
    }

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        price: price || request.price,
        completedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        price: true,
        completedAt: true,
        studentId: true,
        artisanId: true,
      },
    });

    res.json({
      message: 'Request completed. Student can now leave a review.',
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error completing request', error: error.message });
  }
};

exports.cancelRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const request = await prisma.serviceRequest.findFirst({
      where: {
        id,
        studentId: userId,
        status: 'PENDING',
      },
    });

    if (!request) {
      return res.status(403).json({ message: 'You can only cancel your own pending requests.' });
    }

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({
      message: 'Request cancelled.',
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling request', error: error.message });
  }
};

exports.getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const request = await prisma.serviceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        school: true,
        category: true,
        description: true,
        location: true,
        budget: true,
        price: true,
        status: true,
        scheduledAt: true,
        completedAt: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            name: true,
            phone: true,
            school: true,
          },
        },
        artisan: {
          select: {
            id: true,
            name: true,
            phone: true,
            skills: true,
          },
        },
        review: {
          select: {
            id: true,
            rating: true,
            comment: true,
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    const isAuthorized = 
      request.student.id === userId ||
      request.artisan?.id === userId ||
      userRole === 'ADMIN' ||
      userRole === 'SUPER_ADMIN';

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to view this request.' });
    }

    res.json({
      message: 'Request retrieved successfully',
      data: request,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving request', error: error.message });
  }
};