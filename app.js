const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
global.prisma = prisma;

const authRoutes = require('./Src/routes/auth');
const artisanRoutes = require('./Src/routes/artisan');
const serviceRoutes = require('./Src/routes/service');
const reviewRoutes = require('./Src/routes/review');
const studentRoutes = require('./Src/routes/student');
const adminRoutes = require('./Src/routes/admin');
const materialRoutes = require('./Src/routes/material');
const vendorRoutes = require('./Src/routes/vendor');
const menuRoutes = require('./Src/routes/menu');
const foodOrderRoutes = require('./Src/routes/foodOrder');
const accommodationRoutes = require('./Src/routes/accommodation');
const groupProjectRoutes = require('./Src/routes/groupProject');
const tutorRoutes = require('./Src/routes/tutor');
const resitSquadRoutes = require('./Src/routes/resitSquad');
const ridePoolRoutes = require('./Src/routes/ridePool');
const safeWalkRoutes = require('./Src/routes/safeWalk');
const printShopRoutes = require('./Src/routes/print');
const paymentRoutes = require('./Src/routes/payment');
const messageRoutes = require('./Src/routes/message');
const lostFoundRoutes = require('./Src/routes/lostFound');
const marketplaceRoutes = require('./Src/routes/marketplace');
const studyRoutes = require('./Src/routes/study');


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
app.use('/api/print-shops', printShopRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/study', studyRoutes);


app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`CampusPadi API running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});