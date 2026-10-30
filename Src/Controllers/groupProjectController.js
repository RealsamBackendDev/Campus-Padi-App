exports.createProject = async (req, res) => {
  try {
    const { title, description, courseCode, department, maxMembers, skillsNeeded, deadline } = req.body;
    const ownerId = req.user.id;
    const school = req.user.school;

    if (!title || !description || !courseCode || !department || !maxMembers) {
      return res.status(400).json({ message: 'Title, description, course code, department, and max members are required.' });
    }

    if (parseInt(maxMembers) < 2 || parseInt(maxMembers) > 10) {
      return res.status(400).json({ message: 'Max members must be between 2 and 10.' });
    }

    const project = await prisma.groupProject.create({
      data: {
        title,
        description,
        courseCode: courseCode.toUpperCase(),
        department,
        school,
        maxMembers: parseInt(maxMembers),
        skillsNeeded: skillsNeeded || [],
        deadline: deadline ? new Date(deadline) : null,
        ownerId,
      },
      select: {
        id: true,
        title: true,
        courseCode: true,
        department: true,
        maxMembers: true,
        skillsNeeded: true,
        deadline: true,
        status: true,
        createdAt: true,
        owner: {
          select: {
            name: true,
            school: true,
          },
        },
      },
    });

    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: ownerId,
        role: 'owner',
      },
    });

    res.status(201).json({
      message: 'Project created successfully.',
      data: project,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating project', error: error.message });
  }
};

exports.searchProjects = async (req, res) => {
  try {
    const { courseCode, department, skills, page, limit } = req.query;
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

    if (skills) {
      const skillArray = skills.split(',');
      where.skillsNeeded = {
        hasSome: skillArray,
      };
    }

    const [projects, total] = await Promise.all([
      prisma.groupProject.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          courseCode: true,
          department: true,
          maxMembers: true,
          skillsNeeded: true,
          deadline: true,
          status: true,
          createdAt: true,
          owner: {
            select: {
              name: true,
              school: true,
            },
          },
          _count: {
            select: { members: true, applications: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageLimit,
      }),
      prisma.groupProject.count({ where }),
    ]);

    res.json({
      message: 'Projects retrieved successfully',
      data: projects,
      meta: {
        page: currentPage,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error searching projects', error: error.message });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.groupProject.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        courseCode: true,
        department: true,
        school: true,
        maxMembers: true,
        skillsNeeded: true,
        deadline: true,
        status: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            phone: true,
            school: true,
            department: true,
          },
        },
        members: {
          select: {
            role: true,
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
        applications: {
          where: { status: 'PENDING' },
          select: {
            id: true,
            status: true,
            message: true,
            createdAt: true,
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

    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    if (project.school !== req.user.school && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'This project is not available for your school.' });
    }

    res.json({
      message: 'Project retrieved successfully',
      data: project,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving project', error: error.message });
  }
};

exports.applyToProject = async (req, res) => {
  try {
    const { projectId, message } = req.body;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required.' });
    }

    const project = await prisma.groupProject.findUnique({
      where: { id: projectId },
      include: {
        members: true,
        applications: true,
      },
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    if (project.status !== 'OPEN') {
      return res.status(400).json({ message: 'This project is no longer accepting applications.' });
    }

    if (project.school !== req.user.school) {
      return res.status(403).json({ message: 'This project is not available for your school.' });
    }

    if (project.members.length >= project.maxMembers) {
      return res.status(400).json({ message: 'This project is already full.' });
    }

    const isAlreadyMember = project.members.some((m) => m.userId === userId);
    if (isAlreadyMember) {
      return res.status(409).json({ message: 'You are already a member of this project.' });
    }

    const existingApplication = await prisma.projectApplication.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (existingApplication) {
      return res.status(409).json({ message: 'You have already applied to this project.' });
    }

    const application = await prisma.projectApplication.create({
      data: {
        projectId,
        userId,
        message: message || null,
        status: 'PENDING',
      },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Application submitted successfully.',
      data: application,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting application', error: error.message });
  }
};

exports.respondToApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!['ACCEPTED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Status must be ACCEPTED or REJECTED.' });
    }

    const application = await prisma.projectApplication.findUnique({
      where: { id: applicationId },
      include: {
        project: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    if (application.project.ownerId !== userId) {
      return res.status(403).json({ message: 'Only the project owner can respond to applications.' });
    }

    if (application.status !== 'PENDING') {
      return res.status(400).json({ message: 'This application has already been processed.' });
    }

    if (status === 'ACCEPTED' && application.project.members.length >= application.project.maxMembers) {
      return res.status(400).json({ message: 'Project is already full.' });
    }

    await prisma.projectApplication.update({
      where: { id: applicationId },
      data: { status },
    });

    if (status === 'ACCEPTED') {
      await prisma.projectMember.create({
        data: {
          projectId: application.projectId,
          userId: application.userId,
          role: 'member',
        },
      });

      if (application.project.members.length + 1 >= application.project.maxMembers) {
        await prisma.groupProject.update({
          where: { id: application.projectId },
          data: { status: 'CLOSED' },
        });
      }
    }

    res.json({
      message: `Application ${status.toLowerCase()}.`,
      data: { applicationId, status },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error responding to application', error: error.message });
  }
};

exports.getMyProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit } = req.query;
    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;

    const ownedProjects = await prisma.groupProject.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        title: true,
        courseCode: true,
        status: true,
        maxMembers: true,
        createdAt: true,
        _count: {
          select: { members: true, applications: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * pageLimit,
      take: pageLimit,
    });

    const memberProjects = await prisma.projectMember.findMany({
      where: { userId },
      select: {
        role: true,
        project: {
          select: {
            id: true,
            title: true,
            courseCode: true,
            status: true,
            maxMembers: true,
            createdAt: true,
            owner: {
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
      message: 'My projects retrieved successfully',
      data: {
        owned: ownedProjects,
        memberOf: memberProjects,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving my projects', error: error.message });
  }
};

exports.getMyApplications = async (req, res) => {
  try {
    const userId = req.user.id;

    const applications = await prisma.projectApplication.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        project: {
          select: {
            id: true,
            title: true,
            courseCode: true,
            status: true,
            owner: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      message: 'My applications retrieved successfully',
      data: applications,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving my applications', error: error.message });
  }
};

exports.closeProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const project = await prisma.groupProject.findUnique({
      where: { id },
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    if (project.ownerId !== userId) {
      return res.status(403).json({ message: 'Only the project owner can close this project.' });
    }

    const updated = await prisma.groupProject.update({
      where: { id },
      data: { status: 'CLOSED' },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    res.json({
      message: 'Project closed successfully.',
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error closing project', error: error.message });
  }
};

exports.completeProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const project = await prisma.groupProject.findUnique({
      where: { id },
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    if (project.ownerId !== userId) {
      return res.status(403).json({ message: 'Only the project owner can mark this project as completed.' });
    }

    const updated = await prisma.groupProject.update({
      where: { id },
      data: { status: 'COMPLETED' },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    res.json({
      message: 'Project marked as completed.',
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error completing project', error: error.message });
  }
};