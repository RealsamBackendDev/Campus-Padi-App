const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { phone: '08000000000' },
    update: {},
    create: {
      phone: '08000000000',
      password: adminPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      school: 'UI',
      isVerified: true,
    },
  });

  const studentPassword = await bcrypt.hash('student123', 12);
  const student = await prisma.user.upsert({
    where: { phone: '08123456789' },
    update: {},
    create: {
      phone: '08123456789',
      password: studentPassword,
      name: 'Test Student',
      role: 'STUDENT',
      school: 'UI',
      department: 'Computer Science',
      studentId: 'U2018/001',
      isVerified: true,
    },
  });

  const artisan1 = await prisma.artisan.upsert({
    where: { phone: '07012345678' },
    update: {},
    create: {
      name: 'Emeka the Plumber',
      phone: '07012345678',
      skills: ['plumbing', 'pipe_fitting'],
      schools: ['UI', 'POLY_IBADAN'],
      location: 'Agbowo',
      address: '12 Agbowo Road, Ibadan',
      bio: 'Professional plumber with 5 years experience. Available 24/7 for emergencies.',
      isVerified: true,
      rating: 4.5,
      reviewCount: 1,
    },
  });

  const artisan2 = await prisma.artisan.upsert({
    where: { phone: '07087654321' },
    update: {},
    create: {
      name: 'Amina Electricals',
      phone: '07087654321',
      skills: ['electrical', 'generator_repair'],
      schools: ['UI'],
      location: 'Bodija',
      address: '5 Bodija Estate, Ibadan',
      bio: 'Licensed electrician. Specializes in house wiring and generator repairs.',
      isVerified: true,
      rating: 4.8,
      reviewCount: 1,
    },
  });

  const artisan3 = await prisma.artisan.upsert({
    where: { phone: '07011111111' },
    update: {},
    create: {
      name: 'Tunde Phone Repair',
      phone: '07011111111',
      skills: ['phone_repair', 'laptop_repair'],
      schools: ['UI', 'LEAD_CITY'],
      location: 'Sango',
      address: 'Sango Market Road, Ibadan',
      bio: 'I fix all kinds of phones and laptops. Screen replacement expert.',
      isVerified: false,
    },
  });

  const request = await prisma.serviceRequest.create({
    data: {
      studentId: student.id,
      school: 'UI',
      category: 'plumbing',
      description: 'My hostel bathroom pipe is leaking badly. Need urgent repair.',
      location: 'Agbowo',
      budget: 2000,
      status: 'COMPLETED',
      artisanId: artisan1.id,
      price: 2500,
      completedAt: new Date(),
    },
  });

  await prisma.review.create({
    data: {
      serviceRequestId: request.id,
      reviewerId: student.id,
      revieweeId: student.id,
      artisanId: artisan1.id,
      rating: 5,
      comment: 'Emeka came quickly and fixed the leak perfectly. Highly recommended!',
    },
  });

  console.log('Seed complete');
  console.log('Admin: 08000000000 / admin123');
  console.log('Student: 08123456789 / student123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });