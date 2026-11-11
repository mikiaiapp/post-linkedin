// Envío de correo: servicio central (CENTRAL_EMAIL_URL + CENTRAL_EMAIL_KEY) o SMTP directo (SMTP_HOST...).
// Si no hay ninguno configurado, el correo se escribe en el registro del servidor (modo de prueba).
//   SMTP_HOST    servidor SMTP (p. ej. smtp.gmail.com)
//   SMTP_PORT    puerto (por defecto 587; 465 usa TLS directo)
//   SMTP_SECURE  "true" fuerza TLS directo; por defecto solo en el puerto 465 (en el 587 se usa STARTTLS)
//   SMTP_USER / SMTP_PASS   credenciales, si el servidor exige autenticación
//   SMTP_FROM    remitente (por defecto SMTP_USER)
const nodemailer = require('nodemailer');

const APP_NAME = 'PostLinkedIn';

function loadSmtpConfig() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secureEnv = (process.env.SMTP_SECURE || '').toLowerCase();
  const user = process.env.SMTP_USER;
  return {
    host,
    port,
    secure: secureEnv ? secureEnv === 'true' : port === 465,
    user,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || user || undefined
  };
}

async function sendEmail(to, subject, text, html) {
  const centralUrl = process.env.CENTRAL_EMAIL_URL;
  const centralKey = process.env.CENTRAL_EMAIL_KEY;

  if (centralUrl && centralKey) {
    try {
      const base = centralUrl.startsWith('http') ? centralUrl : `https://${centralUrl}`;
      const response = await fetch(`${base}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text, html, key: centralKey, fromName: APP_NAME })
      });
      const result = await response.json();
      if (result.success) {
        console.log(`[CENTRAL EMAIL] Enviado a ${to}`);
        return true;
      }
      console.error('[CENTRAL EMAIL ERROR] Respuesta del servidor:', result);
      return false;
    } catch (error) {
      console.error('[CENTRAL EMAIL ERROR]', error.message);
      return false;
    }
  }

  const smtp = loadSmtpConfig();
  if (smtp) {
    try {
      if (!smtp.from) throw new Error('Falta SMTP_FROM (o SMTP_USER) para indicar el remitente');
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined
      });
      await transporter.sendMail({ from: `"${APP_NAME}" <${smtp.from}>`, to, subject, text, html });
      console.log(`[SMTP] Enviado a ${to}`);
      return true;
    } catch (error) {
      console.error('[SMTP ERROR]', error.message);
      return false;
    }
  }

  console.log('==================================================');
  console.log(`[MOCK EMAIL] To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Content: ${text}`);
  console.log('==================================================');
  return true;
}

module.exports = { sendEmail, APP_NAME };
