exports.createWalk = async (req, res) => {
  try {
    const { fromLocation, toLocation, departureTime, maxWalkers } = req.body;
    const creatorId = req.user.id;
    const school = req.user.school;

    if (!fromLocation || !toLocation || !departureTime) {
      return res.status(400).json({ message: 'From location, to location, and departure time are required.' });
    }

    const walk = await prisma.safeWalk.create({
      data: {
        school,
        fromLocation,
        toLocation,
        departureTime: new Date(departureTime),
        maxWalkers: parseInt(maxWalkers) || 5,
        creatorId,
      },
      select: {
        id: true,
        fromLocation: true,
        toLocation: true,
        departureTime: true,
        maxWalkers: true,
        status: true,
        createdAt: true,
        creator: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    await prisma.safeWalkMember.create({
      data: {
        walkId: walk.id,
        userId: creatorId,
        checkedIn: true,
      },
    });

    res.status(201).json({
      message: 'SafeWalk created successfully.',
      data: walk,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating SafeWalk', error: error.message });
  }
};

exports.searchWalks = async (req, res) => {
  try {
    const { fromLocation, toLocation, page, limit } = req.query;
    const studentSchool = req.user?.school;

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;
    const skip = (currentPage - 1) * pageLimit;

    const where = {
      school: studentSchool,
      status: 'OPEN',
      departureTime: {
        gte: new Date(),
      },
    };

    if (fromLocation) {
      where.fromLocation = {
        contains: fromLocation,
        mode: 'insensitive',
      };
    }

    if (toLocation) {
      where.toLocation = {
        contains: toLocation,
        mode: 'insensitive',
      };
    }

    const [walks, total] = await Promise.all([
      prisma.safeWalk.findMany({
        where,
        select: {
          id: true,
          fromLocation: true,
          toLocation: true,
          departureTime: true,
          maxWalkers: true,
          status: true,
          createdAt: true,
          creator: {
            select: {
              name: true,
            },
          },
          _count: {
            select: { members: true },
          },
        },
        orderBy: { departureTime: 'asc' },
        skip,
        take: pageLimit,
      }),
      prisma.safeWalk.count({ where }),
    ]);

    res.json({
      message: 'SafeWalks retrieved successfully',
      data: walks,
      meta: {
        page: currentPage,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error searching SafeWalks', error: error.message });
  }
};

exports.getWalkById = async (req, res) => {
  try {
    const { id } = req.params;

    const walk = await prisma.safeWalk.findUnique({
      where: { id },
      select: {
        id: true,
        school: true,
        fromLocation: true,
        toLocation: true,
        departureTime: true,
        maxWalkers: true,
        status: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        members: {
          select: {
            joinedAt: true,
            checkedIn: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!walk) {
      return res.status(404).json({ message: 'SafeWalk not found.' });
    }

    if (walk.school !== req.user.school && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'This SafeWalk is not available for your school.' });
    }

    res.json({
      message: 'SafeWalk retrieved successfully',
      data: walk,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving SafeWalk', error: error.message });
  }
};

exports.joinWalk = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const walk = await prisma.safeWalk.findUnique({
      where: { id },
      include: {
        members: true,
      },
    });

    if (!walk) {
      return res.status(404).json({ message: 'SafeWalk not found.' });
    }

    if (walk.status !== 'OPEN') {
      return res.status(400).json({ message: 'This SafeWalk is no longer accepting walkers.' });
    }

    if (walk.school !== req.user.school) {
      return res.status(403).json({ message: 'This SafeWalk is not available for your school.' });
    }

    if (walk.members.length >= walk.maxWalkers) {
      return res.status(400).json({ message: 'This SafeWalk is already full.' });
    }

    const isAlreadyMember = walk.members.some((m) => m.userId === userId);
    if (isAlreadyMember) {
      return res.status(409).json({ message: 'You are already in this SafeWalk.' });
    }

    await prisma.safeWalkMember.create({
      data: {
        walkId: id,
        userId,
      },
    });

    if (walk.members.length + 1 >= walk.maxWalkers) {
      await prisma.safeWalk.update({
        where: { id },
        data: { status: 'FULL' },
      });
    }

    res.json({
      message: 'You have joined the SafeWalk.',
    });
  } catch (error) {
    res.status(500).json({ message: 'Error joining SafeWalk', error: error.message });
  }
};

exports.checkIn = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const membership = await prisma.safeWalkMember.findFirst({
      where: {
        walkId: id,
        userId,
      },
    });

    if (!membership) {
      return res.status(404).json({ message: 'You are not a member of this SafeWalk.' });
    }

    await prisma.safeWalkMember.update({
      where: { id: membership.id },
      data: { checkedIn: true },
    });

    res.json({ message: 'Checked in successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error checking in', error: error.message });
  }
};

exports.getMyWalks = async (req, res) => {
  try {
    const userId = req.user.id;

    const memberships = await prisma.safeWalkMember.findMany({
      where: { userId },
      select: {
        joinedAt: true,
        checkedIn: true,
        walk: {
          select: {
            id: true,
            fromLocation: true,
            toLocation: true,
            departureTime: true,
            status: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    res.json({
      message: 'My SafeWalks retrieved successfully',
      data: memberships,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving my SafeWalks', error: error.message });
  }
};

exports.leaveWalk = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const membership = await prisma.safeWalkMember.findFirst({
      where: {
        walkId: id,
        userId,
      },
    });

    if (!membership) {
      return res.status(404).json({ message: 'You are not in this SafeWalk.' });
    }

    const walk = await prisma.safeWalk.findUnique({
      where: { id },
    });

    if (walk.creatorId === userId) {
      return res.status(400).json({ message: 'The creator cannot leave. Cancel it instead.' });
    }

    await prisma.safeWalkMember.delete({
      where: { id: membership.id },
    });

    if (walk.status === 'FULL') {
      await prisma.safeWalk.update({
        where: { id },
        data: { status: 'OPEN' },
      });
    }

    res.json({ message: 'You have left the SafeWalk.' });
  } catch (error) {
    res.status(500).json({ message: 'Error leaving SafeWalk', error: error.message });
  }
};

exports.cancelWalk = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const walk = await prisma.safeWalk.findUnique({
      where: { id },
    });

    if (!walk) {
      return res.status(404).json({ message: 'SafeWalk not found.' });
    }

    if (walk.creatorId !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only the creator can cancel this SafeWalk.' });
    }

    await prisma.safeWalk.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'SafeWalk cancelled.' });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling SafeWalk', error: error.message });
  }
};

exports.completeWalk = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const walk = await prisma.safeWalk.findUnique({
      where: { id },
    });

    if (!walk) {
      return res.status(404).json({ message: 'SafeWalk not found.' });
    }

    if (walk.creatorId !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only the creator can mark this SafeWalk as completed.' });
    }

    await prisma.safeWalk.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    res.json({ message: 'SafeWalk marked as completed.' });
  } catch (error) {
    res.status(500).json({ message: 'Error completing SafeWalk', error: error.message });
  }
};