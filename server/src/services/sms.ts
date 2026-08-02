import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';

// SMS configuration — set via environment variables in production
const config = {
  accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET || '',
  signName: process.env.SMS_SIGN_NAME || 'VibeLink',
  templateCode: process.env.SMS_TEMPLATE_CODE || 'SMS_123456789',
};

let client: Dysmsapi20170525 | null = null;

function getClient(): Dysmsapi20170525 {
  if (!client) {
    const openApiConfig = new $OpenApi.Config({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      endpoint: 'dysmsapi.aliyuncs.com',
    });
    client = new Dysmsapi20170525(openApiConfig);
  }
  return client;
}

const isConfigured = () => !!(config.accessKeyId && config.accessKeySecret);

export async function sendSMS(phone: string, code: string): Promise<{ success: boolean; dev: boolean }> {
  // If SMS not configured, return code for dev mode
  if (!isConfigured()) {
    console.log(`[SMS DEV] Verification code for ${phone}: ${code}`);
    return { success: true, dev: true };
  }

  try {
    const sendReq = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phone,
      signName: config.signName,
      templateCode: config.templateCode,
      templateParam: JSON.stringify({ code }),
    });

    const response = await getClient().sendSms(sendReq);
    const bodyCode = response.body?.code || '';
    const bodyMessage = response.body?.message || '';
    console.log(`[SMS] Sent to ${phone}, code: ${bodyCode}, message: ${bodyMessage}`);
    return { success: bodyCode === 'OK', dev: false };
  } catch (err: any) {
    console.error('[SMS] Failed:', err.message);
    // Fallback to dev mode
    console.log(`[SMS DEV] Verification code for ${phone}: ${code}`);
    return { success: false, dev: true };
  }
}
