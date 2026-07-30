# Email Service Documentation

## Overview

The Zellavora Control Center email service provides a robust, multi-provider email solution with support for SMTP, SendGrid, and console (development) modes. It includes comprehensive email templates, queue-based processing, and full error handling.

## Features

- ✅ **Multiple Email Providers**: SMTP, SendGrid, Console
- ✅ **Queue-Based Processing**: Async email sending via BullMQ + Redis
- ✅ **Professional Templates**: Pre-built templates for common email types
- ✅ **Batch Sending**: Send multiple emails efficiently
- ✅ **Retry Logic**: Automatic retries for failed emails
- ✅ **Health Checks**: Connection verification endpoints
- ✅ **Comprehensive Logging**: Detailed email service logging

## Configuration

### Environment Variables

```env
# Email Provider: 'console', 'smtp', or 'sendgrid'
EMAIL_PROVIDER=smtp

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@zellavora.com
SMTP_FROM_NAME=Zellavora Control Center

# SendGrid Configuration
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@zellavora.com

# Redis Queue (for async processing)
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
```

## Usage

### Basic Email Sending

```typescript
import { emailService } from './services/email.service';

// Send a simple email
const result = await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome',
  text: 'Plain text content',
  html: '<p>HTML content</p>',
});

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Failed to send:', result.error);
}
```

### Queue-Based Sending (Recommended)

```typescript
import { addQueueJob } from './infrastructure/queue';

// Queue an OTP email
await addQueueJob('send-otp', {
  email: 'user@example.com',
  otp: '123456',
  expiryMinutes: 10,
});
```

### Using Built-in Templates

```typescript
import { emailTemplates } from './services/email.templates';

// OTP Template
const otpTemplate = emailTemplates.otpVerification('123456', 10);

// Email Verification Template
const verifyTemplate = emailTemplates.emailVerification('https://example.com/verify?token=xyz');

// Password Reset Template
const resetTemplate = emailTemplates.passwordResetEmail('https://example.com/reset?token=xyz', 1);

// Welcome Email
const welcomeTemplate = emailTemplates.welcomeEmail('My Organization');

// User Invitation
const inviteTemplate = emailTemplates.userInvitation(
  'https://example.com/invite?token=xyz',
  'John Doe',
  'My Organization'
);

// 2FA Code
const twoFaTemplate = emailTemplates.twoFactorCode('654321', 5);

// Security Alert
const alertTemplate = emailTemplates.accountSecurityAlert(
  'Login from new device',
  new Date().toISOString()
);
```

## Available Queue Jobs

### 1. Send OTP Email
```typescript
await addQueueJob('send-otp', {
  email: string;
  otp: string;
  expiryMinutes?: number; // default: 10
});
```

### 2. Send Welcome Email
```typescript
await addQueueJob('send-welcome', {
  email: string;
  tenantName: string;
});
```

### 3. Send Email Verification
```typescript
await addQueueJob('send-email-verification', {
  email: string;
  verificationLink: string;
});
```

### 4. Send Password Reset
```typescript
await addQueueJob('send-password-reset', {
  email: string;
  resetLink: string;
  expiryHours?: number; // default: 1
});
```

### 5. Send User Invitation
```typescript
await addQueueJob('send-user-invitation', {
  email: string;
  invitationLink: string;
  invitedBy: string;
  tenantName: string;
});
```

### 6. Send 2FA Code
```typescript
await addQueueJob('send-2fa-code', {
  email: string;
  code: string;
  expiryMinutes?: number; // default: 5
});
```

### 7. Send Security Alert
```typescript
await addQueueJob('send-security-alert', {
  email: string;
  alertType: string;
  timestamp?: string; // default: current timestamp
});
```

## API Endpoints

All email endpoints are available at `/api/v1/email/`:

### Health Check
```
GET /api/v1/email/health
```
Response:
```json
{
  "status": "ok",
  "message": "Email service is healthy"
}
```

### Send OTP
```
POST /api/v1/email/send-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456",
  "expiryMinutes": 10
}
```

### Send Welcome Email
```
POST /api/v1/email/send-welcome
Content-Type: application/json

{
  "email": "user@example.com",
  "tenantName": "My Organization"
}
```

### Send Verification Email
```
POST /api/v1/email/send-verification
Content-Type: application/json

{
  "email": "user@example.com",
  "verificationLink": "https://example.com/verify?token=xyz"
}
```

### Send Password Reset
```
POST /api/v1/email/send-password-reset
Content-Type: application/json

{
  "email": "user@example.com",
  "resetLink": "https://example.com/reset?token=xyz",
  "expiryHours": 1
}
```

### Send User Invitation
```
POST /api/v1/email/send-invitation
Content-Type: application/json

{
  "email": "user@example.com",
  "invitationLink": "https://example.com/invite?token=xyz",
  "invitedBy": "John Doe",
  "tenantName": "My Organization"
}
```

### Send 2FA Code
```
POST /api/v1/email/send-2fa-code
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "654321",
  "expiryMinutes": 5
}
```

### Send Security Alert
```
POST /api/v1/email/send-security-alert
Content-Type: application/json

{
  "email": "user@example.com",
  "alertType": "Login from new device",
  "timestamp": "2024-07-31T12:00:00Z"
}
```

## Provider-Specific Setup

### SMTP Configuration

#### Gmail
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Generate app password in Google Account settings
SMTP_FROM_EMAIL=your-email@gmail.com
```

#### SendGrid
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

#### Mailgun
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.com
SMTP_PASSWORD=your-mailgun-password
```

### Console (Development)
```env
EMAIL_PROVIDER=console
```
When enabled, all emails are logged to console instead of being sent.

## Batch Email Sending

```typescript
import { emailService } from './services/email.service';

const emails = [
  {
    to: 'user1@example.com',
    subject: 'Welcome',
    text: 'Hello user1',
    html: '<p>Hello user1</p>',
  },
  {
    to: 'user2@example.com',
    subject: 'Welcome',
    text: 'Hello user2',
    html: '<p>Hello user2</p>',
  },
];

const results = await emailService.sendBatch(emails);
console.log('Sent:', results.filter(r => r.success).length);
```

## Error Handling

All email functions return a `SendEmailResponse`:

```typescript
interface SendEmailResponse {
  success: boolean;
  messageId?: string;  // Unique message ID if successful
  error?: string;      // Error message if failed
}
```

Example:
```typescript
const result = await emailService.sendEmail({...});

if (!result.success) {
  logger.error('Email failed:', result.error);
  // Handle error appropriately
}
```

## Logging

All email operations are logged with structured logging:

```
[Email] OTP sent to user@example.com
[SMTP] Email sent successfully: <message-id>
[Queue] Added job send-otp to Redis queue
[Queue Worker] Job send-otp completed (job-123)
```

## Testing

### Console Mode (Development)
```bash
EMAIL_PROVIDER=console npm run dev
```
All emails will be logged to console.

### Mock SMTP Server
```bash
# Using MailHog or similar
docker run -p 1025:1025 -p 8025:8025 mailhog/mailhog

EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
```

## Best Practices

1. **Always use queue for sending emails**: This prevents blocking requests
2. **Include expiry times**: Set appropriate TTLs for OTPs and reset links
3. **Template variables**: Use consistent naming in email templates
4. **Error handling**: Always check response.success before assuming email was sent
5. **Rate limiting**: Consider rate limiting email endpoints
6. **Audit logging**: Log all email sends for compliance

## Troubleshooting

### SMTP Connection Failed
```
[SMTP] Connection verification failed
```
Check:
- SMTP_HOST and SMTP_PORT are correct
- SMTP_USER and SMTP_PASSWORD are valid
- Firewall allows outbound SMTP connections

### SendGrid Not Working
```
[SendGrid] Send failed
```
Check:
- SENDGRID_API_KEY is valid
- API key has proper permissions
- From email is verified in SendGrid

### Emails Going to Spam
- Add SPF records for your domain
- Add DKIM signatures
- Use SendGrid or other transactional providers
- Include unsubscribe links

### Queue Jobs Not Processing
- Verify Redis is running: `redis-cli ping`
- Check REDIS_URL is correct
- Check worker logs for errors
- Verify REDIS_ENABLED=true

## Security Considerations

1. **Never log credentials**: Sensitive data is never logged
2. **Use app passwords**: For Gmail, use app-specific passwords
3. **Validate email addresses**: Use proper validation before sending
4. **Sanitize templates**: HTML templates should sanitize user input
5. **Rate limiting**: Implement rate limits on email endpoints
6. **GDPR compliance**: Implement unsubscribe mechanisms

## Performance Metrics

- **SMTP**: ~100-500ms per email
- **SendGrid**: ~50-200ms per email
- **Batch sending**: Up to 50 emails per request recommended
- **Queue processing**: Async, non-blocking

## Support

For issues or questions, please check:
1. Environment variables configuration
2. Email provider settings
3. Redis connection (if using queue)
4. Network connectivity
5. Logs in `[Email]`, `[SMTP]`, or `[SendGrid]` prefixes
