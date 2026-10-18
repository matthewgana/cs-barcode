import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/server.js';

test('API Health Check', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.match(res.body.message, /operational/i);
});

test('Auth - Invalid Login Fails', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'hod', password: 'WrongPassword999!' });
  
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('Auth - Valid HOD Login & Session Verification', async () => {
  const agent = request.agent(app);

  const loginRes = await agent
    .post('/api/auth/login')
    .send({ username: 'hod', password: 'Password123!' });

  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.success, true);
  assert.equal(loginRes.body.user.role, 'hod');

  // Verify /api/auth/me using authenticated cookie
  const meRes = await agent.get('/api/auth/me');
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.user.username, 'hod');

  // Verify dashboard stats access
  const statsRes = await agent.get('/api/dashboard/stats');
  assert.equal(statsRes.status, 200);
  assert.equal(statsRes.body.success, true);
  assert.ok(statsRes.body.data.studentsByLevel);

  // Logout
  const logoutRes = await agent.post('/api/auth/logout');
  assert.equal(logoutRes.status, 200);

  // /api/auth/me should fail after logout
  const meAfterRes = await agent.get('/api/auth/me');
  assert.equal(meAfterRes.status, 401);
});

test('RBAC - Unauthenticated Protected Route Access Denied', async () => {
  const res = await request(app).get('/api/students');
  assert.equal(res.status, 401);
});

test('Auth - Student Registration, Barcode Auto-Generation, and Matric Number Login', async () => {
  const uniqueMatric = `U/22/CS/${Math.floor(1000 + Math.random() * 9000)}`;
  const uniqueEmail = `student_${Date.now()}@cs.edu`;
  const agent = request.agent(app);

  // Register Student
  const regRes = await agent
    .post('/api/auth/register')
    .send({
      role: 'student',
      full_name: 'Matthew Gana',
      email: uniqueEmail,
      matric_number: uniqueMatric,
      academic_level: '300',
      password: 'SecurePassword123!',
    });

  assert.equal(regRes.status, 201);
  assert.equal(regRes.body.success, true);
  assert.equal(regRes.body.user.role, 'student');
  assert.equal(regRes.body.user.matricNumber, uniqueMatric);
  assert.ok(regRes.body.user.barcodeValue);

  // Check /api/dashboard/stats returns Student Portal payload
  const studentStatsRes = await agent.get('/api/dashboard/stats');
  assert.equal(studentStatsRes.status, 200);
  assert.equal(studentStatsRes.body.success, true);
  assert.equal(studentStatsRes.body.data.isStudent, true);
  assert.equal(studentStatsRes.body.data.student.matricNumber, uniqueMatric);
  assert.ok(studentStatsRes.body.data.stats);

  // Logout
  await agent.post('/api/auth/logout');

  // Login using Matric Number as username
  const loginByMatricRes = await agent
    .post('/api/auth/login')
    .send({ username: uniqueMatric, password: 'SecurePassword123!' });

  assert.equal(loginByMatricRes.status, 200);
  assert.equal(loginByMatricRes.body.success, true);
  assert.equal(loginByMatricRes.body.user.role, 'student');
  assert.equal(loginByMatricRes.body.user.matricNumber, uniqueMatric);
});

test('Auth - Staff Registration (Lecturer)', async () => {
  const uniqueEmail = `lecturer_${Date.now()}@cs.edu`;
  const agent = request.agent(app);

  const regRes = await agent
    .post('/api/auth/register')
    .send({
      role: 'lecturer',
      full_name: 'Dr. Test Lecturer',
      email: uniqueEmail,
      username: `lect_${Date.now().toString().slice(-6)}`,
      password: 'SecurePassword123!',
    });

  assert.equal(regRes.status, 201);
  assert.equal(regRes.body.success, true);
  assert.equal(regRes.body.user.role, 'lecturer');
});

test('Auth - Duplicate Registration Fails with 409', async () => {
  const existingEmail = `dup_${Date.now()}@cs.edu`;
  const agent = request.agent(app);

  // First registration
  const firstRes = await agent
    .post('/api/auth/register')
    .send({
      role: 'student',
      full_name: 'Original Student',
      email: existingEmail,
      matric_number: `U/22/CS/${Math.floor(1000 + Math.random() * 9000)}`,
      academic_level: '200',
      password: 'SecurePassword123!',
    });
  assert.equal(firstRes.status, 201);

  // Duplicate registration with same email
  const dupRes = await agent
    .post('/api/auth/register')
    .send({
      role: 'student',
      full_name: 'Duplicate Student',
      email: existingEmail,
      matric_number: `U/22/CS/${Math.floor(1000 + Math.random() * 9000)}`,
      academic_level: '200',
      password: 'SecurePassword123!',
    });
  assert.equal(dupRes.status, 409);
  assert.equal(dupRes.body.success, false);
});

