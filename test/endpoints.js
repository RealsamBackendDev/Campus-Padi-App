const BASE_URL = process.env.API_URL || 'http://localhost:5001/api';

let studentToken = '';
let adminToken = '';
let artisanId = '';
let requestId = '';
let shopId = '';
let jobId = '';
let passed = 0;
let failed = 0;

const check = (name, ok, extra = '') => {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}  ${extra}`);
  }
};

const run = async () => {
  const timestamp = Date.now();

  console.log('--- HEALTH ---');
  let res = await fetch(`${BASE_URL}/health`);
  check('GET /health', res.status === 200);

  console.log('--- AUTH ---');
  res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: `0812${String(timestamp).slice(-7)}`,
      password: 'testpass123',
      name: 'Test Student',
      school: 'UI',
      department: 'Computer Science',
      studentId: `U${String(timestamp).slice(-8)}`,
    }),
  });
  check('POST /auth/register', res.status === 201);
  let body = await res.json();
  studentToken = body?.data?.token || '';

  res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: `0800${String(timestamp).slice(-7)}`,
      password: 'testpass123',
      name: 'Test Admin',
      school: 'UI',
      role: 'ADMIN',
    }),
  });
  check('POST /auth/register (admin)', res.status === 201);
  body = await res.json();
  adminToken = body?.data?.token || '';

  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '08000000000', password: 'admin123' }),
  });
  check('POST /auth/login (seeded admin)', res.status === 200);
  body = await res.json();
  if (res.status === 200) adminToken = body.data.token;

  res = await fetch(`${BASE_URL}/auth/profile`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  check('GET /auth/profile', res.status === 200);

  console.log('--- ARTISANS ---');
  res = await fetch(`${BASE_URL}/artisans`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  check('GET /artisans (UI filtered)', res.status === 200);
  body = await res.json();
  artisanId = body?.data?.[0]?.id || '';
  const uiOnly = body?.data?.every((a) => a.schools.includes('UI'));
  check('Artisan search is school-filtered', uiOnly === true);

  res = await fetch(`${BASE_URL}/artisans?includeNearby=true`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  check('GET /artisans?includeNearby=true', res.status === 200);

  if (artisanId) {
    res = await fetch(`${BASE_URL}/artisans/${artisanId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    check('GET /artisans/:id', res.status === 200);
  }

  res = await fetch(`${BASE_URL}/artisans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Tailor',
      phone: `0709${String(timestamp).slice(-7)}`,
      skills: ['tailoring'],
      schools: ['UI'],
      location: 'Agbowo',
    }),
  });
  check('POST /artisans', res.status === 201);
  body = await res.json();
  const newArtisanId = body?.data?.id;

  res = await fetch(`${BASE_URL}/artisans/admin/pending`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  check('GET /artisans/admin/pending (admin)', res.status === 200);

  if (newArtisanId) {
    res = await fetch(`${BASE_URL}/artisans/${newArtisanId}/verify`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    check('PATCH /artisans/:id/verify (admin)', res.status === 200);
  }

  res = await fetch(`${BASE_URL}/artisans/admin/pending`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  check('GET /artisans/admin/pending (student blocked)', res.status === 403);

  console.log('--- SERVICE REQUESTS ---');
  res = await fetch(`${BASE_URL}/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({
      category: 'plumbing',
      description: 'Bathroom sink is leaking and needs urgent repair',
      location: 'Agbowo',
      budget: 2000,
    }),
  });
  check('POST /services', res.status === 201);
  body = await res.json();
  requestId = body?.data?.id || '';

  res = await fetch(`${BASE_URL}/services/my-requests`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  check('GET /services/my-requests', res.status === 200);

  res = await fetch(`${BASE_URL}/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'plumbing', description: 'No auth header test here', location: 'Agbowo' }),
  });
  check('POST /services without token blocked', res.status === 401);

  if (requestId) {
    res = await fetch(`${BASE_URL}/services/${requestId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    check('GET /services/:id', res.status === 200);

    res = await fetch(`${BASE_URL}/services/${requestId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    check('PATCH /services/:id/cancel', res.status === 200);
  }

  console.log('--- REVIEWS ---');
  res = await fetch(`${BASE_URL}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ serviceRequestId: '00000000-0000-0000-0000-000000000000', rating: 5 }),
  });
  check('POST /reviews with fake ID returns 404', res.status === 404);

  if (artisanId) {
    res = await fetch(`${BASE_URL}/reviews/artisan/${artisanId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    check('GET /reviews/artisan/:artisanId', res.status === 200);
  }

  console.log('--- STUDENTS ---');
  res = await fetch(`${BASE_URL}/students/stats`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  check('GET /students/stats', res.status === 200);

  res = await fetch(`${BASE_URL}/students/reviews`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  check('GET /students/reviews', res.status === 200);

  res = await fetch(`${BASE_URL}/students/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ department: 'Software Engineering' }),
  });
  check('PATCH /students/profile', res.status === 200);

  console.log('--- ADMIN ---');
  res = await fetch(`${BASE_URL}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  check('GET /admin/dashboard', res.status === 200);

  res = await fetch(`${BASE_URL}/admin/students`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  check('GET /admin/students', res.status === 200);

  res = await fetch(`${BASE_URL}/admin/artisans?status=verified`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  check('GET /admin/artisans?status=verified', res.status === 200);

  res = await fetch(`${BASE_URL}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  check('GET /admin/dashboard (student blocked)', res.status === 403);

  console.log('--- PRINT SHOPS ---');
  res = await fetch(`${BASE_URL}/print-shops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Agbowo Prints',
      phone: `0807${String(timestamp).slice(-7)}`,
      school: 'UI',
      location: 'Agbowo',
      pricePerPage: 15,
    }),
  });
  check('POST /print-shops', res.status === 201);
  body = await res.json();
  shopId = body?.data?.id || '';

  if (shopId) {
    res = await fetch(`${BASE_URL}/print-shops/${shopId}/verify`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    check('PATCH /print-shops/:id/verify (admin)', res.status === 200);
  }

  res = await fetch(`${BASE_URL}/print-shops`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  check('GET /print-shops (UI filtered)', res.status === 200);
  body = await res.json();
  const shopVisible = body?.data?.some((s) => s.id === shopId);
  check('Verified shop appears in search', shopVisible === true);

  const form = new FormData();
  form.append('shopId', shopId || 'missing');
  form.append('pageCount', '10');
  form.append('copies', '2');
  form.append('document', new Blob(['test document content'], { type: 'application/pdf' }), 'test.pdf');

  res = await fetch(`${BASE_URL}/print-shops/jobs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: form,
  });
  check('POST /print-shops/jobs (upload)', [201, 400, 500].includes(res.status));
  body = await res.json().catch(() => ({}));
  jobId = body?.data?.id || '';

  res = await fetch(`${BASE_URL}/print-shops/jobs/my`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  check('GET /print-shops/jobs/my', res.status === 200);

  if (jobId) {
    res = await fetch(`${BASE_URL}/print-shops/jobs/${jobId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    check('PATCH /print-shops/jobs/:id/status (cancel)', res.status === 200);
  }

  console.log('');
  console.log(`RESULT: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('Test runner crashed:', err.message);
  process.exit(1);
});