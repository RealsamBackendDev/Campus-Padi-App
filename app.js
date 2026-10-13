const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
global.prisma = new PrismaClient();

const authRoutes = require('./routes/auth');
const artisanRoutes = require('./routes/artisan');
const serviceRoutes = require('./routes/service');
const reviewRoutes = require('./routes/review');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');
const materialRoutes = require('./routes/material');
const vendorRoutes = require('./routes/vendor');
const menuRoutes = require('./routes/menu');
const foodOrderRoutes = require('./routes/foodOrder');
const accommodationRoutes = require('./routes/accommodation');
const groupProjectRoutes = require('./routes/groupProject');
const tutorRoutes = require('./routes/tutor');
const resitSquadRoutes = require('./routes/resitSquad');
const ridePoolRoutes = require('./routes/ridePool');
const safeWalkRoutes = require('./routes/safeWalk');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/artisans', artisanRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/food-orders', foodOrderRoutes);
app.use('/api/accommodations', accommodationRoutes);
app.use('/api/projects', groupProjectRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/resit-squads', resitSquadRoutes);
app.use('/api/ride-pools', ridePoolRoutes);
app.use('/api/safe-walks', safeWalkRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`CampusPadi API running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});