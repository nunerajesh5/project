const express = require('express');
const { body } = require('express-validator');
const { handleValidation } = require('../middleware/validation');

const router = express.Router();

// In-memory OTP storage (use Redis or database in production)
const otpStorage = new Map();

// WhatsApp OTP Configuration
// In production, use actual WhatsApp Business API credentials
const WHATSAPP_CONFIG = {
  // For testing: Using WhatsApp Cloud API (Meta)
  // Get credentials from: https://developers.facebook.com/apps/
  apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || 'YOUR_PHONE_NUMBER_ID',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN',
  // Alternative: Twilio WhatsApp API
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioWhatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
};

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Format phone number for WhatsApp (requires country code)
function formatWhatsAppNumber(phoneNumber) {
  const cleaned = phoneNumber.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `91${cleaned}`; // Add India country code
  }
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return cleaned;
  }
  return cleaned;
}

// Send OTP via WhatsApp using Meta's Cloud API
async function sendWhatsAppOTP_Meta(phoneNumber, otp) {
  try {
    const formattedNumber = formatWhatsAppNumber(phoneNumber);
    
    const response = await fetch(
      `${WHATSAPP_CONFIG.apiUrl}/${WHATSAPP_CONFIG.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedNumber,
          type: 'template',
          template: {
            name: 'otp_verification', // Pre-approved template name
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: otp }
                ]
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [
                  { type: 'text', text: otp }
                ]
              }
            ]
          }
        })
      }
    );
    
    const result = await response.json();
    return { success: response.ok, result };
  } catch (error) {
    console.error('WhatsApp Meta API error:', error);
    return { success: false, error: error.message };
  }
}

// Send OTP via WhatsApp using Twilio
async function sendWhatsAppOTP_Twilio(phoneNumber, otp) {
  try {
    if (!WHATSAPP_CONFIG.twilioAccountSid || !WHATSAPP_CONFIG.twilioAuthToken) {
      return { success: false, error: 'Twilio credentials not configured' };
    }

    const formattedNumber = formatWhatsAppNumber(phoneNumber);
    const client = require('twilio')(
      WHATSAPP_CONFIG.twilioAccountSid,
      WHATSAPP_CONFIG.twilioAuthToken
    );

    const message = await client.messages.create({
      body: `Your verification code is: ${otp}. This code will expire in 5 minutes. Do not share this code with anyone.`,
      from: WHATSAPP_CONFIG.twilioWhatsappNumber,
      to: `whatsapp:+${formattedNumber}`
    });

    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error('Twilio WhatsApp error:', error);
    return { success: false, error: error.message };
  }
}

// Send OTP via WhatsApp (Development mode - simulates sending)
async function sendWhatsAppOTP_Development(phoneNumber, otp) {
  const formattedNumber = formatWhatsAppNumber(phoneNumber);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📱 WhatsApp OTP Message (Development Mode)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`To: +${formattedNumber}`);
  console.log(`OTP: ${otp}`);
  console.log('Message: Your verification code is: ' + otp);
  console.log('         This code expires in 5 minutes.');
  console.log('═══════════════════════════════════════════════════════════');
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return { 
    success: true, 
    development: true,
    message: `OTP ${otp} would be sent to WhatsApp +${formattedNumber}` 
  };
}

// Main function to send WhatsApp OTP
async function sendWhatsAppOTP(phoneNumber, otp) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Try Twilio first, fallback to Meta API
    if (WHATSAPP_CONFIG.twilioAccountSid) {
      return await sendWhatsAppOTP_Twilio(phoneNumber, otp);
    } else if (WHATSAPP_CONFIG.accessToken !== 'YOUR_ACCESS_TOKEN') {
      return await sendWhatsAppOTP_Meta(phoneNumber, otp);
    }
  }
  
  // Development mode
  return await sendWhatsAppOTP_Development(phoneNumber, otp);
}

// Send OTP endpoint (now sends to WhatsApp)
router.post('/send', [ body('phoneNumber').isString() ], handleValidation, async (req, res) => {
  const { phoneNumber } = req.body;
  console.log('WhatsApp OTP requested for:', phoneNumber);
  
  // Generate OTP
  const otp = generateOTP();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiry
  
  // Store OTP
  const formattedNumber = formatWhatsAppNumber(phoneNumber);
  otpStorage.set(formattedNumber, { otp, expiresAt, attempts: 0 });
  
  // Send via WhatsApp
  const result = await sendWhatsAppOTP(phoneNumber, otp);
  
  if (result.success) {
    return res.json({ 
      success: true, 
      message: 'OTP sent to your WhatsApp',
      channel: 'whatsapp',
      // Include OTP in development for testing
      ...(process.env.NODE_ENV !== 'production' && { otp }),
      expiresIn: 300 // 5 minutes in seconds
    });
  } else {
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to send OTP. Please try again.',
      error: result.error
    });
  }
});

// Verify OTP endpoint
router.post('/verify', [ body('phoneNumber').isString(), body('otp').isString() ], handleValidation, async (req, res) => {
  const { phoneNumber, otp } = req.body;
  console.log('OTP verification requested for:', phoneNumber);
  
  const formattedNumber = formatWhatsAppNumber(phoneNumber);
  const storedData = otpStorage.get(formattedNumber);
  
  // Check if OTP exists
  if (!storedData) {
    return res.json({ 
      success: false,
      message: 'OTP expired or not requested. Please request a new OTP.'
    });
  }
  
  // Check expiry
  if (Date.now() > storedData.expiresAt) {
    otpStorage.delete(formattedNumber);
    return res.json({ 
      success: false,
      message: 'OTP has expired. Please request a new OTP.'
    });
  }
  
  // Check attempts
  if (storedData.attempts >= 3) {
    otpStorage.delete(formattedNumber);
    return res.json({ 
      success: false,
      message: 'Too many failed attempts. Please request a new OTP.'
    });
  }
  
  // Verify OTP
  if (storedData.otp === otp) {
    otpStorage.delete(formattedNumber); // Clear after successful verification
    return res.json({ 
      success: true,
      message: 'Phone number verified successfully'
    });
  } else {
    // Increment attempts
    storedData.attempts += 1;
    otpStorage.set(formattedNumber, storedData);
    
    const remainingAttempts = 3 - storedData.attempts;
    return res.json({ 
      success: false,
      message: `Invalid OTP. ${remainingAttempts} attempts remaining.`
    });
  }
});

// Resend OTP endpoint (via WhatsApp)
router.post('/resend', [ body('phoneNumber').isString() ], handleValidation, async (req, res) => {
  const { phoneNumber } = req.body;
  console.log('WhatsApp OTP resend requested for:', phoneNumber);
  
  // Generate new OTP
  const otp = generateOTP();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  
  // Store new OTP
  const formattedNumber = formatWhatsAppNumber(phoneNumber);
  otpStorage.set(formattedNumber, { otp, expiresAt, attempts: 0 });
  
  // Send via WhatsApp
  const result = await sendWhatsAppOTP(phoneNumber, otp);
  
  if (result.success) {
    return res.json({ 
      success: true, 
      message: 'New OTP sent to your WhatsApp',
      channel: 'whatsapp',
      ...(process.env.NODE_ENV !== 'production' && { otp }),
      expiresIn: 300
    });
  } else {
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to resend OTP. Please try again.',
      error: result.error
    });
  }
});

// Send OTP specifically via WhatsApp (explicit endpoint)
router.post('/send-whatsapp', [ body('phoneNumber').isString() ], handleValidation, async (req, res) => {
  const { phoneNumber } = req.body;
  console.log('Explicit WhatsApp OTP requested for:', phoneNumber);
  
  const otp = generateOTP();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  
  const formattedNumber = formatWhatsAppNumber(phoneNumber);
  otpStorage.set(formattedNumber, { otp, expiresAt, attempts: 0 });
  
  const result = await sendWhatsAppOTP(phoneNumber, otp);
  
  if (result.success) {
    return res.json({ 
      success: true, 
      message: 'OTP sent to your WhatsApp number',
      channel: 'whatsapp',
      phoneNumber: `+${formattedNumber}`,
      ...(process.env.NODE_ENV !== 'production' && { otp }),
      expiresIn: 300
    });
  } else {
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to send WhatsApp OTP',
      error: result.error
    });
  }
});

module.exports = router;

