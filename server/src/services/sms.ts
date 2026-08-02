// YunPian SMS Service — simple HTTP API, no SDK needed
// Sign up at https://www.yunpian.com to get your API key
// Docs: https://www.yunpian.com/official/document/sms/zh_cn/domestic_single_send

const API_KEY = process.env.SMS_API_KEY || '';
const API_URL = 'https://sms.yunpian.com/v2/sms/single_send.json';

const isConfigured = () => !!API_KEY;

export async function sendSMS(phone: string, code: string): Promise<{ success: boolean; dev: boolean }> {
  // If SMS not configured, return code for dev mode
  if (!isConfigured()) {
    console.log(`[SMS DEV] Verification code for ${phone}: ${code}`);
    return { success: true, dev: true };
  }

  try {
    const text = `【VibeLink】您的验证码是${code}。如非本人操作，请忽略本短信。`;

    const https = require('https');
    const { URL } = require('url');
    const body = `apikey=${encodeURIComponent(API_KEY)}&mobile=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}`;

    const result: any = await new Promise((resolve, reject) => {
      const url = new URL(API_URL);
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
      }, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON response')); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    console.log(`[SMS] Sent to ${phone}, code: ${result.code}, msg: ${result.msg}`);

    if (result.code === 0) {
      return { success: true, dev: false };
    }

    console.error(`[SMS] YunPian error: ${result.msg} (code: ${result.code})`);
    // Fallback to dev mode on API error
    console.log(`[SMS DEV] Verification code for ${phone}: ${code}`);
    return { success: false, dev: true };
  } catch (err: any) {
    console.error('[SMS] Failed:', err.message);
    console.log(`[SMS DEV] Verification code for ${phone}: ${code}`);
    return { success: false, dev: true };
  }
}
