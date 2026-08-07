import * as nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '465');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log('[Email] SMTP not configured, codes will be logged to console only');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  console.log(`[Email] SMTP ready: ${smtpUser}@${smtpHost}`);
  return transporter;
}

export async function sendEmailCode(to: string, code: string, purpose: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.log(`[Email] [${purpose}] Code for ${to}: ${code}`);
    return false; // SMTP not configured, fallback to console
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `VibeLink 验证码：${code}`,
      text: `您的验证码是：${code}，5分钟内有效。用途：${purpose}`,
      html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">
        <h2 style="color:#5B9BD5">VibeLink</h2>
        <p>您的验证码是：</p>
        <div style="font-size:28px;font-weight:700;color:#333;letter-spacing:4px;padding:16px 0">${code}</div>
        <p style="color:#888;font-size:13px">5分钟内有效。用途：${purpose}</p>
      </div>`,
    });
    console.log(`[Email] Sent to ${to} for ${purpose}`);
    return true;
  } catch (err: any) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    return false;
  }
}
