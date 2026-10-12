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
