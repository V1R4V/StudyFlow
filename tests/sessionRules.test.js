import test from 'node:test';
import assert from 'node:assert/strict';

// Optional integration check against a local emulator, never a live project.
const host = process.env.FIRESTORE_EMULATOR_HOST;
test('session rules accept recorded/legacy sessions and reject invalid times and other users', { skip: !host }, async () => {
  assert.match(host, /^(127\.0\.0\.1|localhost):\d+$/);
  const project = 'demo-studyflow-timing';
  const now = Date.now();
  const payload = {
    sub: 'timing-test-user', user_id: 'timing-test-user', aud: project,
    iss: `https://securetoken.google.com/${project}`, iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600, firebase: { sign_in_provider: 'custom' },
  };
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
  const base = { id: 1, subjectId: 'math', subjectName: 'Math', date: '2026-10-01',
    durationSeconds: 60, duration: 1, focusRating: 4, userId: payload.sub };
  async function write(data, userId = payload.sub) {
    const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key,
      typeof value === 'number' ? { doubleValue: value } : { stringValue: value }]));
    const response = await fetch(`http://${host}/v1/projects/${project}/databases/(default)/documents/studyflow_v1/${userId}/sessions`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    return { status: response.status, body: await response.text() };
  }
  const timing = { startedAt: now - 120000, endedAt: now - 60000 };
  for (const data of [base, { ...base, ...timing }]) {
    const result = await write(data);
    assert.equal(result.status, 200, result.body);
  }
  for (const data of [
    { ...base, startedAt: timing.startedAt },
    { ...base, endedAt: timing.endedAt },
    { ...base, ...timing, endedAt: timing.startedAt - 1 },
    { ...base, ...timing, startedAt: String(timing.startedAt) },
    { ...base, ...timing, endedAt: now + 3600000 },
    { ...base, ...timing, durationSeconds: 180 },
  ]) {
    const result = await write(data);
    assert.equal(result.status, 403, result.body);
  }
  assert.equal((await write({ ...base, ...timing, userId: 'other-user' }, 'other-user')).status, 403);
});
