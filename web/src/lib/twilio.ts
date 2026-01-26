import twilio from 'twilio';

// Twilio client singleton
let twilioClient: twilio.Twilio | null = null;

export function getTwilioClient(): twilio.Twilio {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('Missing Twilio credentials');
    }

    twilioClient = twilio(accountSid, authToken);
  }

  return twilioClient;
}

// Generate capability token for browser softphone
export function generateAccessToken(identity: string): string {
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    throw new Error('Missing Twilio configuration');
  }

  const accessToken = new AccessToken(
    accountSid,
    apiKeySid,
    apiKeySecret,
    { identity }
  );

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  accessToken.addGrant(voiceGrant);

  return accessToken.toJwt();
}

// Validate Twilio webhook signature
export function validateTwilioRequest(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    throw new Error('Missing Twilio auth token');
  }

  return twilio.validateRequest(authToken, signature, url, params);
}

// Format phone number to E.164
export function formatE164(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`;
  }

  return cleaned;
}

// Validate phone number
export function validatePhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// Mask phone number for logging
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
}

// SMS Types
export interface SendSMSResult {
  success: boolean;
  sid?: string;
  status?: string;
  error?: string;
  errorCode?: string;
}

// Send SMS via Twilio
export async function sendSMS(
  to: string,
  body: string,
  from?: string
): Promise<SendSMSResult> {
  try {
    const client = getTwilioClient();
    const fromNumber = from || process.env.TWILIO_PHONE_NUMBER;

    if (!fromNumber) {
      return { success: false, error: 'No from number configured' };
    }

    const messageOptions: {
      to: string;
      from: string;
      body: string;
      statusCallback?: string;
    } = {
      to: formatE164(to),
      from: fromNumber,
      body,
    };

    // Only add statusCallback if APP_URL is configured
    if (process.env.NEXT_PUBLIC_APP_URL) {
      messageOptions.statusCallback = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/webhook/status`;
    }

    const message = await client.messages.create(messageOptions);

    return {
      success: true,
      sid: message.sid,
      status: message.status,
    };
  } catch (err) {
    const error = err as { message?: string; code?: number };
    return {
      success: false,
      error: error.message || 'Failed to send SMS',
      errorCode: error.code?.toString(),
    };
  }
}
