exports.createPool = async (req, res) => {
  try {
    const { fromLocation, toLocation, departureTime, maxRiders, pricePerRider, vehicleType } = req.body;
    const creatorId = req.user.id;
    const school = req.user.school;

    if (!fromLocation || !toLocation || !departureTime || !maxRiders || !pricePerRider || !vehicleType) {
      return res.status(400).json({ message: 'From location, to location, departure time, max riders, price per rider, and vehicle type are required.' });
    }

    const validTypes = ['okada', 'keke', 'bus'];
    if (!validTypes.includes(vehicleType)) {
      return res.status(400).json({ message: 'Invalid vehicle type. Allowed: okada, keke, bus' });
    }

    if (parseInt(maxRiders) < 2 || parseInt(maxRiders) > 6) {
      return res.status(400).json({ message: 'Max riders must be between 2 and 6.' });
    }

    const pool = await prisma.ridePool.create({
      data: {
        school,
        fromLocation,
        toLocation,
        departureTime: new Date(departureTime),
        maxRiders: parseInt(maxRiders),
        pricePerRider: parseFloat(pricePerRider),
        vehicleType,
        creatorId,
      },
      select: {
        id: true,
        fromLocation: true,
        toLocation: true,
        departureTime: true,
        maxRiders: true,
        pricePerRider: true,
        vehicleType: true,
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

    await prisma.ridePoolMember.create({
      data: {
        poolId: pool.id,
        userId: creatorId,
      },
    });

    res.status(201).json({
      message: 'Ride pool created successfully.',
      data: pool,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating ride pool', error: error.message });
  }
};

exports.searchPools = async (req, res) => {
  try {
    const { fromLocation, toLocation, vehicleType, page, limit } = req.query;
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

    if (vehicleType) where.vehicleType = vehicleType;

    const [pools, total] = await Promise.all([
      prisma.ridePool.findMany({
        where,
        select: {
          id: true,
          fromLocation: true,
          toLocation: true,
          departureTime: true,
          maxRiders: true,
          pricePerRider: true,
          vehicleType: true,
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
      prisma.ridePool.count({ where }),
    ]);

    res.json({
      message: 'Ride pools retrieved successfully',
      data: pools,
      meta: {
        page: currentPage,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error searching ride pools', error: error.message });
  }
};

exports.getPoolById = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await prisma.ridePool.findUnique({
      where: { id },
      select: {
        id: true,
        school: true,
        fromLocation: true,
        toLocation: true,
        departureTime: true,
        maxRiders: true,
        pricePerRider: true,
        vehicleType: true,
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

    if (!pool) {
      return res.status(404).json({ message: 'Ride pool not found.' });
    }

    if (pool.school !== req.user.school && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'This ride pool is not available for your school.' });
    }

    res.json({
      message: 'Ride pool retrieved successfully',
      data: pool,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving ride pool', error: error.message });
  }
};

exports.joinPool = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const pool = await prisma.ridePool.findUnique({
      where: { id },
      include: {
        members: true,
      },
    });

    if (!pool) {
      return res.status(404).json({ message: 'Ride pool not found.' });
    }

    if (pool.status !== 'OPEN') {
      return res.status(400).json({ message: 'This ride pool is no longer accepting riders.' });
    }

    if (pool.school !== req.user.school) {
      return res.status(403).json({ message: 'This ride pool is not available for your school.' });
    }

    if (pool.members.length >= pool.maxRiders) {
      return res.status(400).json({ message: 'This ride pool is already full.' });
    }

    const isAlreadyMember = pool.members.some((m) => m.userId === userId);
    if (isAlreadyMember) {
      return res.status(409).json({ message: 'You are already in this ride pool.' });
    }

    await prisma.ridePoolMember.create({
      data: {
        poolId: id,
        userId,
      },
    });

    if (pool.members.length + 1 >= pool.maxRiders) {
      await prisma.ridePool.update({
        where: { id },
        data: { status: 'FULL' },
      });
    }

    res.json({
      message: 'You have joined the ride pool.',
    });
  } catch (error) {
    res.status(500).json({ message: 'Error joining ride pool', error: error.message });
  }
};

exports.getMyPools = async (req, res) => {
  try {
    const userId = req.user.id;

    const memberships = await prisma.ridePoolMember.findMany({
      where: { userId },
      select: {
        joinedAt: true,
        pool: {
          select: {
            id: true,
            fromLocation: true,
            toLocation: true,
            departureTime: true,
            pricePerRider: true,
            vehicleType: true,
            status: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    res.json({
      message: 'My ride pools retrieved successfully',
      data: memberships,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving my ride pools', error: error.message });
  }
};

exports.leavePool = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const membership = await prisma.ridePoolMember.findFirst({
      where: {
        poolId: id,
        userId,
      },
    });

    if (!membership) {
      return res.status(404).json({ message: 'You are not in this ride pool.' });
    }

    const pool = await prisma.ridePool.findUnique({
      where: { id },
    });

    if (pool.creatorId === userId) {
      return res.status(400).json({ message: 'The creator cannot leave the pool. Cancel it instead.' });
    }

    await prisma.ridePoolMember.delete({
      where: { id: membership.id },
    });

    if (pool.status === 'FULL') {
      await prisma.ridePool.update({
        where: { id },
        data: { status: 'OPEN' },
      });
    }

    res.json({ message: 'You have left the ride pool.' });
  } catch (error) {
    res.status(500).json({ message: 'Error leaving ride pool', error: error.message });
  }
};

exports.cancelPool = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const pool = await prisma.ridePool.findUnique({
      where: { id },
    });

    if (!pool) {
      return res.status(404).json({ message: 'Ride pool not found.' });
    }

    if (pool.creatorId !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only the creator can cancel this pool.' });
    }

    await prisma.ridePool.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'Ride pool cancelled.' });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling ride pool', error: error.message });
  }
};