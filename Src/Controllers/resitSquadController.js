exports.createSquad = async (req, res) => {
  try {
    const { courseCode, department, level, maxMembers, description } = req.body;
    const createdById = req.user.id;
    const school = req.user.school;

    if (!courseCode || !department || !level || !maxMembers) {
      return res.status(400).json({ message: 'Course code, department, level, and max members are required.' });
    }

    if (parseInt(maxMembers) < 2 || parseInt(maxMembers) > 20) {
      return res.status(400).json({ message: 'Max members must be between 2 and 20.' });
    }

    const squad = await prisma.resitSquad.create({
      data: {
        courseCode: courseCode.toUpperCase(),
        department,
        level,
        school,
        maxMembers: parseInt(maxMembers),
        description: description || null,
        createdById,
      },
      select: {
        id: true,
        courseCode: true,
        department: true,
        level: true,
        maxMembers: true,
        description: true,
        status: true,
        createdAt: true,
        createdBy: {
          select: {
            name: true,
            school: true,
          },
        },
      },
    });

    await prisma.resitSquadMember.create({
      data: {
        squadId: squad.id,
        userId: createdById,
      },
    });

    res.status(201).json({
      message: 'Resit squad created successfully.',
      data: squad,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating resit squad', error: error.message });
  }
};

exports.searchSquads = async (req, res) => {
  try {
    const { courseCode, department, level, page, limit } = req.query;
    const studentSchool = req.user?.school;

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;
    const skip = (currentPage - 1) * pageLimit;

    const where = {
      school: studentSchool,
      status: 'OPEN',
    };

    if (courseCode) {
      where.courseCode = {
        contains: courseCode.toUpperCase(),
        mode: 'insensitive',
      };
    }

    if (department) {
      where.department = {
        contains: department,
        mode: 'insensitive',
      };
    }

    if (level) where.level = level;

    const [squads, total] = await Promise.all([
      prisma.resitSquad.findMany({
        where,
        select: {
          id: true,
          courseCode: true,
          department: true,
          level: true,
          maxMembers: true,
          description: true,
          status: true,
          createdAt: true,
          createdBy: {
            select: {
              name: true,
              school: true,
            },
          },
          _count: {
            select: { members: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageLimit,
      }),
      prisma.resitSquad.count({ where }),
    ]);

    res.json({
      message: 'Resit squads retrieved successfully',
      data: squads,
      meta: {
        page: currentPage,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error searching resit squads', error: error.message });
  }
};

exports.getSquadById = async (req, res) => {
  try {
    const { id } = req.params;

    const squad = await prisma.resitSquad.findUnique({
      where: { id },
      select: {
        id: true,
        courseCode: true,
        department: true,
        level: true,
        school: true,
        maxMembers: true,
        description: true,
        status: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            phone: true,
            school: true,
          },
        },
        members: {
          select: {
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                department: true,
              },
            },
          },
        },
      },
    });

    if (!squad) {
      return res.status(404).json({ message: 'Squad not found.' });
    }

    if (squad.school !== req.user.school && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'This squad is not available for your school.' });
    }

    res.json({
      message: 'Squad retrieved successfully',
      data: squad,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving squad', error: error.message });
  }
};

exports.joinSquad = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const squad = await prisma.resitSquad.findUnique({
      where: { id },
      include: {
        members: true,
      },
    });

    if (!squad) {
      return res.status(404).json({ message: 'Squad not found.' });
    }

    if (squad.status !== 'OPEN') {
      return res.status(400).json({ message: 'This squad is no longer accepting members.' });
    }

    if (squad.school !== req.user.school) {
      return res.status(403).json({ message: 'This squad is not available for your school.' });
    }

    if (squad.members.length >= squad.maxMembers) {
      return res.status(400).json({ message: 'This squad is already full.' });
    }

    const isAlreadyMember = squad.members.some((m) => m.userId === userId);
    if (isAlreadyMember) {
      return res.status(409).json({ message: 'You are already a member of this squad.' });
    }

    await prisma.resitSquadMember.create({
      data: {
        squadId: id,
        userId,
      },
    });

    if (squad.members.length + 1 >= squad.maxMembers) {
      await prisma.resitSquad.update({
        where: { id },
        data: { status: 'CLOSED' },
      });
    }

    res.json({
      message: 'You have joined the resit squad.',
    });
  } catch (error) {
    res.status(500).json({ message: 'Error joining squad', error: error.message });
  }
};

exports.getMySquads = async (req, res) => {
  try {
    const userId = req.user.id;

    const squads = await prisma.resitSquadMember.findMany({
      where: { userId },
      select: {
        joinedAt: true,
        squad: {
          select: {
            id: true,
            courseCode: true,
            department: true,
            level: true,
            status: true,
            maxMembers: true,
            createdBy: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    res.json({
      message: 'My squads retrieved successfully',
      data: squads,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving my squads', error: error.message });
  }
};

exports.leaveSquad = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const membership = await prisma.resitSquadMember.findFirst({
      where: {
        squadId: id,
        userId,
      },
    });

    if (!membership) {
      return res.status(404).json({ message: 'You are not a member of this squad.' });
    }

    await prisma.resitSquadMember.delete({
      where: { id: membership.id },
    });

    const squad = await prisma.resitSquad.findUnique({
      where: { id },
      include: { members: true },
    });

    if (squad.status === 'CLOSED' && squad.members.length - 1 < squad.maxMembers) {
      await prisma.resitSquad.update({
        where: { id },
        data: { status: 'OPEN' },
      });
    }

    res.json({ message: 'You have left the squad.' });
  } catch (error) {
    res.status(500).json({ message: 'Error leaving squad', error: error.message });
  }
};