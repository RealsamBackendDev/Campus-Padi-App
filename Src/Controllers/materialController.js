exports.uploadMaterial = async (req, res) => {
  try {
    const { title, description, courseCode, department, level, price } = req.body;
    const uploaderId = req.user.id;
    const school = req.user.school;

    if (!title || !courseCode || !department || !level) {
      return res.status(400).json({ message: 'Title, course code, department, and level are required.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file provided.' });
    }

    const fileUrl = req.file.path;
    const fileType = req.file.mimetype || 'application/pdf';

    const material = await prisma.material.create({
      data: {
        title,
        description: description || null,
        courseCode: courseCode.toUpperCase(),
        department,
        level,
        school,
        fileUrl,
        fileType,
        price: parseFloat(price) || 0,
        uploaderId,
        isApproved: false,
      },
      select: {
        id: true,
        title: true,
        courseCode: true,
        department: true,
        level: true,
        school: true,
        fileType: true,
        price: true,
        isApproved: true,
        createdAt: true,
        uploader: {
          select: {
            name: true,
            school: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Material uploaded successfully. Pending approval.',
      data: material,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading material', error: error.message });
  }
};

exports.searchMaterials = async (req, res) => {
  try {
    const { courseCode, department, level, search, page, limit } = req.query;
    const studentSchool = req.user?.school;

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;
    const skip = (currentPage - 1) * pageLimit;

    const where = {
      school: studentSchool,
      isApproved: true,
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

    if (level) {
      where.level = level;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { courseCode: { contains: search.toUpperCase(), mode: 'insensitive' } },
      ];
    }

    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          courseCode: true,
          department: true,
          level: true,
          school: true,
          fileType: true,
          price: true,
          downloadCount: true,
          createdAt: true,
          uploader: {
            select: {
              name: true,
              school: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageLimit,
      }),
      prisma.material.count({ where }),
    ]);

    res.json({
      message: 'Materials retrieved successfully',
      data: materials,
      meta: {
        page: currentPage,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
        school: studentSchool,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error searching materials', error: error.message });
  }
};

exports.getMaterialById = async (req, res) => {
  try {
    const { id } = req.params;

    const material = await prisma.material.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        courseCode: true,
        department: true,
        level: true,
        school: true,
        fileType: true,
        price: true,
        downloadCount: true,
        isApproved: true,
        createdAt: true,
        uploader: {
          select: {
            name: true,
            school: true,
          },
        },
      },
    });

    if (!material) {
      return res.status(404).json({ message: 'Material not found.' });
    }

    if (material.school !== req.user.school && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'This material is not available for your school.' });
    }

    res.json({
      message: 'Material retrieved successfully',
      data: material,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving material', error: error.message });
  }
};

exports.downloadMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    const material = await prisma.material.findUnique({
      where: { id },
    });

    if (!material) {
      return res.status(404).json({ message: 'Material not found.' });
    }

    if (!material.isApproved) {
      return res.status(403).json({ message: 'This material is pending approval.' });
    }

    if (material.school !== req.user.school) {
      return res.status(403).json({ message: 'This material is not available for your school.' });
    }

    await prisma.material.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });

    res.json({
      message: 'Download ready',
      data: {
        fileUrl: material.fileUrl,
        fileType: material.fileType,
        title: material.title,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing download', error: error.message });
  }
};

exports.getMyMaterials = async (req, res) => {
  try {
    const uploaderId = req.user.id;
    const { page, limit } = req.query;
    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 20;

    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where: { uploaderId },
        select: {
          id: true,
          title: true,
          courseCode: true,
          department: true,
          level: true,
          price: true,
          downloadCount: true,
          isApproved: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (currentPage - 1) * pageLimit,
        take: pageLimit,
      }),
      prisma.material.count({ where: { uploaderId } }),
    ]);

    res.json({
      message: 'My materials retrieved successfully',
      data: materials,
      meta: { page: currentPage, limit: pageLimit, total },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving my materials', error: error.message });
  }
};

exports.approveMaterial = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;

    const material = await prisma.material.update({
      where: { id },
      data: { isApproved: true },
      select: {
        id: true,
        title: true,
        courseCode: true,
        isApproved: true,
        uploader: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    res.json({
      message: 'Material approved successfully.',
      data: material,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error approving material', error: error.message });
  }
};

exports.getPendingMaterials = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const materials = await prisma.material.findMany({
      where: { isApproved: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        courseCode: true,
        department: true,
        level: true,
        school: true,
        fileType: true,
        createdAt: true,
        uploader: {
          select: {
            name: true,
            phone: true,
            school: true,
          },
        },
      },
    });

    res.json({
      message: 'Pending materials retrieved successfully',
      data: materials,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving pending materials', error: error.message });
  }
};

exports.deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const material = await prisma.material.findUnique({
      where: { id },
    });

    if (!material) {
      return res.status(404).json({ message: 'Material not found.' });
    }

    if (material.uploaderId !== userId && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'You can only delete your own materials.' });
    }

    await prisma.material.delete({
      where: { id },
    });

    res.json({ message: 'Material deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting material', error: error.message });
  }
};