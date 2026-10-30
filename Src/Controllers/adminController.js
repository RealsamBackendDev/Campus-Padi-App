exports.getDashboardStats = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const totalStudents = await prisma.user.count({
      where: { role: 'STUDENT' }
    });

    const totalArtisans = await prisma.artisan.count();
    const verifiedArtisans = await prisma.artisan.count({ where: { isVerified: true } });
    const pendingArtisans = await prisma.artisan.count({ where: { isVerified: false } });

    const totalRequests = await prisma.serviceRequest.count();
    const pendingRequests = await prisma.serviceRequest.count({ where: { status: 'PENDING' } });
    const completedRequests = await prisma.serviceRequest.count({ where: { status: 'COMPLETED' } });

    const totalReviews = await prisma.review.count();
    const avgPlatformRating = await prisma.review.aggregate({
      _avg: { rating: true }
    });

    const recentRequests = await prisma.serviceRequest.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        category: true,
        status: true,
        createdAt: true,
        student: { select: { name: true, school: true } },
        artisan: { select: { name: true } }
      }
    });

    res.status(200).json({
      message: 'Dashboard stats retrieved successfully',
      stats: {
        users: { totalStudents },
        artisans: { total: totalArtisans, verified: verifiedArtisans, pending: pendingArtisans },
        requests: { total: totalRequests, pending: pendingRequests, completed: completedRequests },
        reviews: { total: totalReviews, averageRating: avgPlatformRating._avg.rating || 0 },
        recentActivity: recentRequests
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving dashboard stats', error: error.message });
  }
};

exports.getAllStudents = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { school, page, limit } = req.query;
    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;
    const skip = (currentPage - 1) * pageLimit;

    const where = { role: 'STUDENT' };
    if (school) where.school = school;

    const [students, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          phone: true,
          name: true,
          email: true,
          school: true,
          department: true,
          studentId: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: { serviceRequests: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageLimit
      }),
      prisma.user.count({ where })
    ]);

    res.status(200).json({
      message: 'Students retrieved successfully',
      count: total,
      students
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving students', error: error.message });
  }
};

exports.getAllArtisans = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { status, school, page, limit } = req.query;
    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;
    const skip = (currentPage - 1) * pageLimit;

    const where = {};
    if (status === 'verified') where.isVerified = true;
    if (status === 'pending') where.isVerified = false;
    if (school) where.schools = { has: school };

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
          isVerified: true,
          rating: true,
          reviewCount: true,
          createdAt: true,
          _count: {
            select: { serviceRequests: true, reviews: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageLimit
      }),
      prisma.artisan.count({ where })
    ]);

    res.status(200).json({
      message: 'Artisans retrieved successfully',
      count: total,
      artisans
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving artisans', error: error.message });
  }
};

exports.verifyArtisan = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;

    const artisan = await prisma.artisan.update({
      where: { id },
      data: { isVerified: true },
      select: {
        id: true,
        name: true,
        phone: true,
        isVerified: true,
        schools: true,
      }
    });

    res.status(200).json({
      message: 'Artisan verified successfully',
      artisan
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying artisan', error: error.message });
  }
};

exports.rejectArtisan = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const artisan = await prisma.artisan.update({
      where: { id },
      data: { isVerified: false },
      select: {
        id: true,
        name: true,
        phone: true,
        isVerified: true,
      }
    });

    res.status(200).json({
      message: 'Artisan verification rejected',
      reason: reason || 'No reason provided',
      artisan
    });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting artisan', error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Super admin only.' });
    }

    const { id } = req.params;

    await prisma.user.delete({
      where: { id }
    });

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};