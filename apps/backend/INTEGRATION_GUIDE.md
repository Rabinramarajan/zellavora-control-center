# Email Service Integration Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```
The `@sendgrid/mail` package has been added to package.json.

### 2. Configure Environment
Add to `.env.local`:

```env
# Email Provider (required)
EMAIL_PROVIDER=console

# For SMTP Provider:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@zellavora.com
SMTP_FROM_NAME=Zellavora Control Center

# For SendGrid Provider:
SENDGRID_API_KEY=SG.your-api-key
SENDGRID_FROM_EMAIL=noreply@zellavora.com

# Optional: Redis for queue processing
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
```

### 3. Start the Server
```bash
npm run dev
```

### 4. Test Email Service
```bash
# Check health
curl http://localhost:3000/api/v1/email/health

# Send test OTP
curl -X POST http://localhost:3000/api/v1/email/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'
```

## Integration in Your Code

### Using the Email Helper (Recommended)
```typescript
import { EmailHelper } from './utils/email-helper';

// Send OTP
const success = await EmailHelper.sendOtp('user@example.com', '123456');

// Send welcome email
await EmailHelper.sendWelcome('user@example.com', 'My Organization');

// Send verification link
const verifyLink = EmailHelper.generateVerificationLink(
  'https://yourapp.com',
  'token-xyz'
);
await EmailHelper.sendEmailVerification('user@example.com', verifyLink);

// Send password reset
const resetLink = EmailHelper.generateResetLink('https://yourapp.com', 'token-xyz');
await EmailHelper.sendPasswordReset('user@example.com', resetLink);

// Generate OTP
const otp = EmailHelper.generateOTP(6); // Returns 6-digit code
```

### Direct Queue Usage
```typescript
import { addQueueJob } from './infrastructure/queue';

// Queue email for async processing
await addQueueJob('send-otp', {
  email: 'user@example.com',
  otp: '123456',
  expiryMinutes: 10
});
```

### Direct Email Service
```typescript
import { emailService } from './services/email.service';

const result = await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Custom Email',
  text: 'Plain text',
  html: '<p>HTML content</p>'
});

if (result.success) {
  console.log('Sent:', result.messageId);
}
```

## Integration Points

### Authentication Flow
```typescript
// In your registration endpoint
import { EmailHelper } from './utils/email-helper';

const otp = EmailHelper.generateOTP();
await EmailHelper.sendOtp(email, otp);
```

### User Verification
```typescript
// In your email verification endpoint
const verifyLink = EmailHelper.generateVerificationLink(
  process.env.VITE_API_URL,
  token
);
await EmailHelper.sendEmailVerification(email, verifyLink);
```

### Password Recovery
```typescript
// In your forgot password endpoint
const resetLink = EmailHelper.generateResetLink(
  process.env.VITE_API_URL,
  resetToken
);
await EmailHelper.sendPasswordReset(email, resetLink);
```

### Organization Onboarding
```typescript
// After creating organization
await EmailHelper.sendWelcome(
  organizationCreatorEmail,
  organizationName
);
```

### User Invitations
```typescript
// When inviting users
const inviteLink = EmailHelper.generateInvitationLink(
  process.env.VITE_API_URL,
  invitationToken
);
await EmailHelper.sendInvitation(
  inviteeEmail,
  inviteLink,
  invitingUserName,
  organizationName
);
```

### Security Alerts
```typescript
// When suspicious activity detected
await EmailHelper.sendSecurityAlert(
  email,
  'Login attempt from new device',
  new Date().toISOString()
);
```

### Two-Factor Authentication
```typescript
// When sending 2FA code
const code = EmailHelper.generateOTP(6);
await EmailHelper.send2FACode(email, code, 5); // 5 minute expiry
```

## File Structure

```
src/
├── services/
│   ├── email.service.ts          # Core email service
│   ├── email.templates.ts        # Email HTML templates
│   └── EMAIL_SERVICE.md          # Service documentation
├── routes/
│   └── email.routes.ts           # API endpoints
├── infrastructure/
│   └── queue.ts                  # Queue job handlers
├── utils/
│   └── email-helper.ts           # Email utility functions
└── app.ts                        # Updated with email routes
```

## API Endpoints Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/email/health` | Health check |
| POST | `/api/v1/email/send-otp` | Send OTP |
| POST | `/api/v1/email/send-welcome` | Send welcome |
| POST | `/api/v1/email/send-verification` | Email verification |
| POST | `/api/v1/email/send-password-reset` | Password reset |
| POST | `/api/v1/email/send-invitation` | User invitation |
| POST | `/api/v1/email/send-2fa-code` | 2FA code |
| POST | `/api/v1/email/send-security-alert` | Security alert |

## Provider Configuration Examples

### Gmail SMTP
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=generated-app-password
```

### SendGrid
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

### Development/Console
```env
EMAIL_PROVIDER=console
```
Emails logged to console instead of sent.

## Error Handling

All email functions return success/error status. Always check the result:

```typescript
const success = await EmailHelper.sendOtp(email, otp);

if (!success) {
  // Handle error - email queue failed
  // But will retry if Redis queue enabled
}
```

## Monitoring & Logs

Look for these log prefixes:
- `[Email]` - General email operations
- `[SMTP]` - SMTP provider operations
- `[SendGrid]` - SendGrid provider operations
- `[Queue]` - Queue operations
- `[Queue Worker]` - Background job processing

Example log output:
```
[Email] OTP sent to user@example.com
[Queue] Added job send-otp to Redis queue
[Queue Worker] Job send-otp completed (job-123)
```

## Testing Checklist

- [ ] Install dependencies: `npm install`
- [ ] Set EMAIL_PROVIDER in .env.local
- [ ] Start server: `npm run dev`
- [ ] Check health: `GET /api/v1/email/health`
- [ ] Send test OTP: `POST /api/v1/email/send-otp`
- [ ] Verify email received (or logged to console)
- [ ] Check logs for `[Email]` prefix messages
- [ ] Test with different providers (smtp, sendgrid, console)

## Production Checklist

- [ ] Set EMAIL_PROVIDER to production provider (smtp or sendgrid)
- [ ] Configure SMTP credentials or SendGrid API key
- [ ] Enable Redis for queue processing
- [ ] Set up monitoring/alerting for failed emails
- [ ] Add rate limiting to email endpoints
- [ ] Configure email sending in all auth flows
- [ ] Test email delivery in staging
- [ ] Set up email templates review process
- [ ] Document email configuration for ops team

## Troubleshooting

### Emails not being sent
1. Check health: `GET /api/v1/email/health`
2. Verify EMAIL_PROVIDER is set
3. Check SMTP/SendGrid credentials
4. Review logs for `[Email]` messages

### "Connection verification failed"
1. Verify SMTP_HOST and SMTP_PORT
2. Check firewall allows SMTP
3. Verify credentials are correct
4. Test credentials with mail client

### SendGrid errors
1. Verify SENDGRID_API_KEY
2. Check key has proper permissions
3. Verify SENDGRID_FROM_EMAIL is verified
4. Review SendGrid API documentation

### Queue not processing
1. Verify Redis is running: `redis-cli ping`
2. Check REDIS_URL is correct
3. Set REDIS_ENABLED=true
4. Review `[Queue Worker]` logs

## Support Resources

- **Full Documentation**: `src/services/EMAIL_SERVICE.md`
- **Implementation Details**: `NODEMAILER_IMPLEMENTATION.md`
- **Email Helper**: `src/utils/email-helper.ts`
- **Templates**: `src/services/email.templates.ts`
- **Routes**: `src/routes/email.routes.ts`
