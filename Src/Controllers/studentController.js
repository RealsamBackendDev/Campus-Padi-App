const verifyOwnership = (req, resourceOwnerId) => {
  if (req.user.id !== resourceOwnerId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return false;
  }
  return true;
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, email, department, studentId } = req.body;
    const userId = req.user.id;

    if (studentId) {
      const existingStudentId = await prisma.user.findFirst({
        where: {
          studentId,
          NOT: { id: userId }
        }
      });

      if (existingStudentId) {
        return res.status(409).json({ message: 'Student ID already registered to another account.' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(department && { department }),
        ...(studentId && { studentId }),
      },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        school: true,
        department: true,
        studentId: true,
        profileImage: true,
        isVerified: true,
        role: true,
        createdAt: true,
      }
    });

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
};

exports.uploadProfileImage = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    const imageUrl = req.file.path;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profileImage: imageUrl },
      select: {
        id: true,
        name: true,
        profileImage: true,
      }
    });

    res.status(200).json({
      message: 'Profile image uploaded successfully',
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading profile image', error: error.message });
  }
};

exports.getMyStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const totalRequests = await prisma.serviceRequest.count({
      where: { studentId: userId }
    });

    const completedRequests = await prisma.serviceRequest.count({
      where: { studentId: userId, status: 'COMPLETED' }
    });

    const pendingRequests = await prisma.serviceRequest.count({
      where: { studentId: userId, status: { in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] } }
    });

    const totalReviews = await prisma.review.count({
      where: { reviewerId: userId }
    });

    const avgRatingGiven = await prisma.review.aggregate({
      where: { reviewerId: userId },
      _avg: { rating: true }
    });

    res.status(200).json({
      message: 'Student stats retrieved successfully',
      stats: {
        totalRequests,
        completedRequests,
        pendingRequests,
        totalReviews,
        averageRatingGiven: avgRatingGiven._avg.rating || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving student stats', error: error.message });
  }
};

exports.getMyReviews = async (req, res) => {
  try {
    const userId = req.user.id;

    const reviews = await prisma.review.findMany({
      where: { reviewerId: userId },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        artisan: {
          select: {
            id: true,
            name: true,
            skills: true,
          }
        },
        serviceRequest: {
          select: {
            id: true,
            category: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      message: 'Reviews retrieved successfully',
      count: reviews.length,
      reviews
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving reviews', error: error.message });
  }
};

exports.getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!verifyOwnership(req, id)) {
      return res.status(403).json({ message: 'Access denied. You can only view your own profile.' });
    }

    const student = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        school: true,
        department: true,
        studentId: true,
        profileImage: true,
        isVerified: true,
        role: true,
        createdAt: true,
        artisanProfile: {
          select: {
            id: true,
            skills: true,
            isVerified: true,
            rating: true,
          }
        }
      }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.status(200).json({
      message: 'Student retrieved successfully',
      student
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving student', error: error.message });
  }
};