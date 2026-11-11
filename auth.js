// Sistema de usuarios de PostLinkedIn (mismo estándar que ContaMiki):
// registro con verificación del correo, acceso con JWT, 2FA con app autenticadora (TOTP),
// recuperación y cambio de contraseña, y la clave de Gemini guardada cifrada por usuario.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { sendEmail, APP_NAME } = require('./mailer');

// --- Configuración ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ [CONFIG] Falta JWT_SECRET: defínela como variable de entorno. No arranco.');
  process.exit(1);
}
const PORT = process.env.PORT || 3080;
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const USERS_DIR = path.join(DATA_DIR, 'users');
fs.mkdirSync(USERS_DIR, { recursive: true });

// --- Almacén de usuarios (fichero JSON; escritura atómica) ---
function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function saveUsers(users) {
  const tmp = `${USERS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), 'utf-8');
  fs.renameSync(tmp, USERS_FILE);
}

const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

const validateEmail = (email) =>
  /^[^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(String(email));

// Carpeta de datos propia de cada usuario (propuestas)
function getUserDir(user) {
  const dir = path.join(USERS_DIR, user.id);
  fs.mkdirSync(path.join(dir, 'proposals'), { recursive: true });
  return dir;
}

// --- Clave de Gemini: cifrada (AES-256-GCM) con una clave derivada de JWT_SECRET ---
const encKey = crypto.createHash('sha256').update(`postlinkedin-gemini-key:${JWT_SECRET}`).digest();

function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

function decryptSecret(blob) {
  try {
    const [iv, tag, enc] = blob.split('.').map((s) => Buffer.from(s, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null; // JWT_SECRET cambiada o dato dañado: el usuario deberá volver a introducirla
  }
}

function getGeminiKey(user) {
  return user.geminiKeyEnc ? decryptSecret(user.geminiKeyEnc) : null;
}

// --- Middleware de sesión ---
function authenticateToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    if (payload.isPreAuth) return res.status(403).json({ error: '2FA Requerido' });
    const user = readUsers().find((u) => u.id === payload.id);
    if (!user) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
}

const signSession = (user) => jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

// --- Rutas ---
const router = express.Router();

router.post('/register', async (req, res) => {
  const username = normalizeEmail(req.body.username);
  const { password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Datos incompletos' });
  if (!validateEmail(username)) return res.status(400).json({ error: 'El usuario debe ser un email válido' });

  try {
    const users = readUsers();
    if (users.find((u) => u.username === username)) return res.status(400).json({ error: 'Usuario/Email ya registrado' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    users.push({
      id: crypto.randomUUID(),
      username,
      password: await bcrypt.hash(password, 10),
      isVerified: false,
      verificationToken
    });
    saveUsers(users);

    const link = `${APP_URL}?action=verify&token=${verificationToken}`;
    await sendEmail(
      username,
      `Verifica tu cuenta en ${APP_NAME}`,
      `Haz click en este enlace para activar tu cuenta: ${link}`,
      `<p>Bienvenido a ${APP_NAME}.</p><p>Para activar tu cuenta, haz clic aquí:</p><a href="${link}">${link}</a>`
    );

    res.json({ success: true, message: 'Usuario creado. Revisa tu email para activar la cuenta.' });
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ error: 'Error server' });
  }
});

router.post('/resend-verification', async (req, res) => {
  const username = normalizeEmail(req.body.username);
  try {
    const users = readUsers();
    const user = users.find((u) => u.username === username);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });
    if (user.isVerified) return res.status(400).json({ error: 'El usuario ya está verificado' });

    user.verificationToken = crypto.randomBytes(32).toString('hex');
    saveUsers(users);

    const link = `${APP_URL}?action=verify&token=${user.verificationToken}`;
    await sendEmail(
      username,
      `Verifica tu cuenta en ${APP_NAME} (Reenvío)`,
      `Haz click en este enlace para activar tu cuenta: ${link}`,
      `<p>Has solicitado reenviar el correo de validación.</p><p><a href="${link}">Activar cuenta ahora</a></p>`
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al reenviar email' });
  }
});

router.post('/verify', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token requerido' });
  try {
    const users = readUsers();
    const user = users.find((u) => u.verificationToken && u.verificationToken === token);
    if (!user) return res.status(400).json({ error: 'Token inválido o expirado' });
    user.isVerified = true;
    user.verificationToken = null;
    saveUsers(users);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error server' });
  }
});

router.post('/login', async (req, res) => {
  const username = normalizeEmail(req.body.username);
  const { password } = req.body;
  try {
    const user = readUsers().find((u) => u.username === username);
    if (!user || !password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    if (user.isVerified === false) return res.status(403).json({ error: 'Cuenta no verificada. Revisa tu email.' });

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      // Token temporal de 5 minutos: solo vale para /login/2fa
      const tempToken = jwt.sign({ id: user.id, isPreAuth: true }, JWT_SECRET, { expiresIn: '5m' });
      return res.json({ requires2fa: true, tempToken });
    }
    res.json({ token: signSession(user), username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Error server' });
  }
});

router.post('/login/2fa', (req, res) => {
  const { tempToken, code } = req.body;
  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET);
    if (!decoded.isPreAuth) return res.status(401).json({ error: 'Token inválido para 2FA' });
    const user = readUsers().find((u) => u.id === decoded.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const verified = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: String(code || '') });
    if (!verified) return res.status(401).json({ error: 'Código 2FA incorrecto' });
    res.json({ token: signSession(user), username: user.username });
  } catch (err) {
    res.status(401).json({ error: 'Sesión 2FA expirada o inválida' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  try {
    const users = readUsers();
    const user = users.find((u) => u.username === email);
    if (!user) return res.json({ success: true }); // no revela si la cuenta existe

    user.resetToken = crypto.randomBytes(32).toString('hex');
    user.resetExpires = Date.now() + 3600000; // 1 hora
    saveUsers(users);

    const link = `${APP_URL}?action=reset&token=${user.resetToken}`;
    await sendEmail(
      email,
      `Recuperación de Contraseña - ${APP_NAME}`,
      `Usa este enlace para cambiar tu contraseña: ${link}`,
      `<p>Has solicitado recuperar tu contraseña.</p><p><a href="${link}">Haz clic aquí para resetearla</a></p><p>Este enlace expira en 1 hora.</p>`
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error server' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const users = readUsers();
    const user = token && users.find((u) => u.resetToken === token && u.resetExpires > Date.now());
    if (!user) return res.status(400).json({ error: 'Enlace inválido o expirado' });
    if (!newPassword) return res.status(400).json({ error: 'Datos incompletos' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetExpires = null;
    saveUsers(users);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error server' });
  }
});

// --- Rutas con sesión ---
const secured = express.Router();
secured.use(authenticateToken);

secured.get('/me', (req, res) => {
  const u = req.user;
  res.json({
    username: u.username,
    twoFactorEnabled: !!u.twoFactorEnabled,
    hasGeminiKey: !!u.geminiKeyEnc,
    geminiKeyLast4: u.geminiKeyLast4 || null
  });
});

secured.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    if (!newPassword) return res.status(400).json({ error: 'Datos incompletos' });
    const users = readUsers();
    const user = users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!(await bcrypt.compare(currentPassword || '', user.password))) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    saveUsers(users);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

secured.post('/delete-account', (req, res) => {
  try {
    const users = readUsers();
    const rest = users.filter((u) => u.id !== req.user.id);
    if (rest.length === users.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    saveUsers(rest);
    fs.rmSync(path.join(USERS_DIR, req.user.id), { recursive: true, force: true });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar cuenta' });
  }
});

// 2FA (solo app autenticadora)
secured.post('/2fa/setup', async (req, res) => {
  try {
    const users = readUsers();
    const user = users.find((u) => u.id === req.user.id);
    const secret = speakeasy.generateSecret({ name: `${APP_NAME} (${user.username})` });
    user.tempTwoFactorSecret = secret.base32;
    saveUsers(users);
    res.json({ secret: secret.base32, qrCode: await QRCode.toDataURL(secret.otpauth_url) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error configurando 2FA' });
  }
});

secured.post('/2fa/verify-setup', (req, res) => {
  try {
    const users = readUsers();
    const user = users.find((u) => u.id === req.user.id);
    if (!user || !user.tempTwoFactorSecret) return res.status(400).json({ error: 'No hay configuración 2FA pendiente' });
    const ok = speakeasy.totp.verify({ secret: user.tempTwoFactorSecret, encoding: 'base32', token: String(req.body.token || '') });
    if (!ok) return res.status(400).json({ error: 'Código incorrecto' });
    user.twoFactorSecret = user.tempTwoFactorSecret;
    user.twoFactorEnabled = true;
    user.tempTwoFactorSecret = null;
    saveUsers(users);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error verificando 2FA' });
  }
});

secured.post('/2fa/disable', (req, res) => {
  try {
    const users = readUsers();
    const user = users.find((u) => u.id === req.user.id);
    if (user) {
      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      saveUsers(users);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error desactivando 2FA' });
  }
});

secured.get('/2fa/status', (req, res) => res.json({ enabled: !!req.user.twoFactorEnabled }));

// Clave de Gemini de cada usuario (nunca se devuelve completa)
secured.put('/gemini-key', (req, res) => {
  const key = String(req.body.key || '').trim();
  if (!key) return res.status(400).json({ error: 'Clave requerida' });
  try {
    const users = readUsers();
    const user = users.find((u) => u.id === req.user.id);
    user.geminiKeyEnc = encryptSecret(key);
    user.geminiKeyLast4 = key.slice(-4);
    saveUsers(users);
    res.json({ success: true, geminiKeyLast4: user.geminiKeyLast4 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error guardando la clave' });
  }
});

secured.delete('/gemini-key', (req, res) => {
  try {
    const users = readUsers();
    const user = users.find((u) => u.id === req.user.id);
    user.geminiKeyEnc = null;
    user.geminiKeyLast4 = null;
    saveUsers(users);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error borrando la clave' });
  }
});

router.use(secured);

module.exports = { router, authenticateToken, getUserDir, getGeminiKey, validateEmail };
