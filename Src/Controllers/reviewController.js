exports.createReview = async (req, res) => {
  try {
    const { serviceRequestId, rating, comment } = req.body;
    const reviewerId = req.user.id;

    if (!serviceRequestId || !rating) {
      return res.status(400).json({ message: 'Service request ID and rating are required.' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: {
        review: true,
        artisan: true,
        student: true,
      },
    });

    if (!serviceRequest) {
      return res.status(404).json({ message: 'Service request not found.' });
    }

    if (serviceRequest.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'You can only review completed requests.' });
    }

    if (serviceRequest.review) {
      return res.status(409).json({ message: 'You have already reviewed this request.' });
    }

    if (serviceRequest.studentId !== reviewerId) {
      return res.status(403).json({ message: 'Only the request owner can leave a review.' });
    }

    if (!serviceRequest.artisanId) {
      return res.status(400).json({ message: 'No artisan assigned to this request.' });
    }

    const review = await prisma.review.create({
      data: {
        serviceRequestId,
        reviewerId,
        revieweeId: serviceRequest.studentId,
        artisanId: serviceRequest.artisanId,
        rating,
        comment: comment || null,
      },
    });

    const artisanReviews = await prisma.review.findMany({
      where: { artisanId: serviceRequest.artisanId },
      select: { rating: true },
    });

    const avgRating = artisanReviews.reduce((sum, r) => sum + r.rating, 0) / artisanReviews.length;

    await prisma.artisan.update({
      where: { id: serviceRequest.artisanId },
      data: {
        rating: parseFloat(avgRating.toFixed(2)),
        reviewCount: artisanReviews.length,
      },
    });

    res.status(201).json({
      message: 'Review submitted successfully.',
      data: review,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating review', error: error.message });
  }
};

exports.getArtisanReviews = async (req, res) => {
  try {
    const { artisanId } = req.params;
    const { page, limit } = req.query;
    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;

    const reviews = await prisma.review.findMany({
      where: { artisanId },
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
      skip: (currentPage - 1) * pageLimit,
      take: pageLimit,
    });

    const total = await prisma.review.count({
      where: { artisanId },
    });

    res.json({
      message: 'Reviews retrieved successfully',
      data: reviews,
      meta: { page: currentPage, limit: pageLimit, total },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving reviews', error: error.message });
  }
};