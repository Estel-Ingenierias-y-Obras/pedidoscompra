const { test, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const { validarTokenMicrosoft } = require('../middleware/auth');
const Usuario = require('../models/Usuario');
const logger = require('../utils/logger');
const tenant = '11111111-1111-4111-8111-111111111111';
const client = '22222222-2222-4222-8222-222222222222';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
const jwt = cambios => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ tid: tenant, iss: `https://login.microsoftonline.com/${tenant}/v2.0`, aud: client,
    exp: Math.floor(Date.now()/1000) + 300, preferred_username: 'real@example.com', name: 'Persona real', ...cambios })).toString('base64url');
  return `${header}.${payload}.${crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url')}`;
};
let server, base;
before(async () => {
  process.env.ENTRA_TENANT_ID = tenant; process.env.ENTRA_CLIENT_ID = client;
  global.fetch = async (url, options) => String(url).startsWith('https://login.microsoftonline.com/')
    ? { ok: true, json: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test-key' }] }) }
    : originalFetch(url, options);
  const app = express(); app.use(express.json());
  app.use('/acceso', require('../routes/solicitudesAcceso'));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); global.fetch = originalFetch; process.env = originalEnv; });
beforeEach(() => mock.restoreAll());

test('JWT exige firma válida, expiración numérica vigente, tenant y audiencia correctos', async () => {
  assert.equal((await validarTokenMicrosoft(jwt())).email, 'real@example.com');
  for (const cambios of [{ exp: undefined }, { exp: 'invalid' }, { exp: 1 }, { tid: 'otro' }, { aud: 'otra-app' }, { nbf: 'invalid' }, { nbf: Date.now() }]) {
    await assert.rejects(validarTokenMicrosoft(jwt(cambios)));
  }
  const token = jwt();
  await assert.rejects(validarTokenMicrosoft(token.slice(0, -12) + 'manipulado'));
});

test('solicitar acceso sin token no consulta usuarios ni divulga perfiles', async () => {
  const consulta = mock.method(Usuario, 'findOne', async () => { throw new Error('No debe consultar'); });
  const r = await fetch(`${base}/acceso`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com' }) });
  assert.equal(r.status, 401); assert.equal(consulta.mock.callCount(), 0);
});

test('solicitar acceso usa el email firmado y no la identidad suministrada en el cuerpo', async () => {
  mock.method(Usuario, 'findOne', async filtro => {
    assert.match(filtro.email.$regex, /real/); assert.doesNotMatch(filtro.email.$regex, /admin/);
    return { _id: 'usuario', nombre: 'Persona real', email: 'real@example.com', rol: 'Usuario', activo: true };
  });
  const r = await fetch(`${base}/acceso`, { method: 'POST', headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', rol: 'Admin' }) });
  assert.equal(r.status, 200); assert.equal((await r.json()).usuario.email, 'real@example.com');
});

test('un usuario desactivado no recibe autorización al iniciar sesión', async () => {
  mock.method(Usuario, 'findOne', async () => ({ activo: false }));
  const r = await fetch(`${base}/acceso`, { method: 'POST', headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 403);
});

test('el logger descarta credenciales, URLs, IDs y errores completos incluso en producción', () => {
  const salida = []; mock.method(console, 'error', value => salida.push(value));
  process.env.NODE_ENV = 'production'; process.env.LOG_LEVEL = 'INFO';
  logger.error('bc.error', { status: 403, token: 'SECRETO', url: 'https://interno', tenant: tenant, error: new Error('SECRETO') });
  assert.equal(salida.length, 1);
  assert.equal(JSON.parse(salida[0]).status, 403);
  for (const secreto of ['SECRETO', tenant, 'https://interno']) assert.ok(!salida[0].includes(secreto));
  process.env.LOG_LEVEL = 'SILENT'; logger.error('bc.error'); assert.equal(salida.length, 1);
  delete process.env.LOG_LEVEL;
});
