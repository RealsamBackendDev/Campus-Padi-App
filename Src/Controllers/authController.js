const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      phone: user.phone, 
      role: user.role,
      school: user.school,
      name: user.name 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

exports.register = async (req, res) => {
  try {
    const { phone, password, name, email, school, department, studentId, role } = req.body;

    if (!phone || !password || !name || !school) {
      return res.status(400).json({ message: 'Phone, password, name, and school are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const validSchools = ['UI', 'POLY_IBADAN', 'LEAD_CITY', 'LAUTECH'];
    if (!validSchools.includes(school)) {
      return res.status(400).json({ message: 'Invalid school.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return res.status(409).json({ message: 'Phone number already registered.' });
    }

    if (studentId) {
      const existingId = await prisma.user.findUnique({ where: { studentId } });
      if (existingId) {
        return res.status(409).json({ message: 'Student ID already registered.' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        phone,
        password: hashedPassword,
        name,
        email,
        school,
        department,
        studentId,
        role: role || 'STUDENT',
      },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        role: true,
        school: true,
        department: true,
        studentId: true,
        isVerified: true,
        createdAt: true,
      },
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'Registration successful',
      data: { user, token },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required.' });
    }

    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid phone number or password.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid phone number or password.' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          role: user.role,
          school: user.school,
          department: user.department,
          studentId: user.studentId,
          isVerified: user.isVerified,
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        role: true,
        school: true,
        department: true,
        studentId: true,
        profileImage: true,
        isVerified: true,
        createdAt: true,
        artisanProfile: {
          select: {
            id: true,
            skills: true,
            isVerified: true,
            rating: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({
      message: 'Profile retrieved successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving profile', error: error.message });
  }
};