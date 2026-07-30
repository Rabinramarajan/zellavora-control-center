import { config } from '../config/env';

export const emailTemplates = {
  otpVerification: (otp: string, expiryMinutes: number = 10) => ({
    subject: 'ZCC Registration OTP Verification',
    text: `Your ZELLAVORA CONTROL CENTER registration OTP is: ${otp}. Valid for ${expiryMinutes} minutes.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px;">ZELLAVORA CONTROL CENTER</h2>
        </div>
        <div style="padding: 30px 20px;">
          <p style="color: #374151; font-size: 16px; margin-top: 0;">Your verification OTP code for signing up is:</p>
          <div style="font-size: 48px; font-weight: bold; color: #4f46e5; letter-spacing: 8px; padding: 20px 0; text-align: center; background: #f3f4f6; border-radius: 8px; margin: 20px 0;">${otp}</div>
          <p style="color: #6b7280; font-size: 14px;">This code is valid for ${expiryMinutes} minutes.</p>
          <div style="border-top: 1px solid #e5e7eb; margin: 20px 0; padding-top: 20px;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">If you did not request this code, you can safely ignore this email. Your account will not be created unless you complete the verification process.</p>
          </div>
        </div>
        <div style="background: #f9fafb; padding: 15px 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 11px; color: #9ca3af;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Zellavora. All rights reserved.</p>
        </div>
      </div>
    `,
  }),

  emailVerification: (verificationLink: string) => ({
    subject: 'Verify Your Email Address - ZCC',
    text: `Please verify your email address by clicking this link: ${verificationLink}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px;">Email Verification</h2>
        </div>
        <div style="padding: 30px 20px;">
          <p style="color: #374151; font-size: 16px;">Welcome! Please verify your email address to complete your registration.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background: #6366f1; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Verify Email</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Or copy this link: ${verificationLink}</p>
          <div style="border-top: 1px solid #e5e7eb; margin: 20px 0; padding-top: 20px;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">This link will expire in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
          </div>
        </div>
        <div style="background: #f9fafb; padding: 15px 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 11px; color: #9ca3af;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Zellavora. All rights reserved.</p>
        </div>
      </div>
    `,
  }),

  welcomeEmail: (tenantName: string) => ({
    subject: `Welcome to ZELLAVORA CONTROL CENTER - ${tenantName}`,
    text: `Welcome to ZCC! Your workspace for ${tenantName} is active and ready.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to ZCC!</h2>
        </div>
        <div style="padding: 30px 20px;">
          <p style="color: #374151; font-size: 16px;">Hello,</p>
          <p style="color: #374151; font-size: 16px;">Your organization <strong>${tenantName}</strong> has been registered successfully in Zellavora Control Center.</p>
          <p style="color: #374151; font-size: 16px;">You can now:</p>
          <ul style="color: #374151; font-size: 14px;">
            <li>Log in to the administrative panel using your superadmin credentials</li>
            <li>Invite team members to your workspace</li>
            <li>Configure organization settings and policies</li>
            <li>Start managing your resources</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.apiUrl.replace('/api/v1', '')}" style="background: #6366f1; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Go to ZCC</a>
          </div>
          <div style="border-top: 1px solid #e5e7eb; margin: 20px 0; padding-top: 20px;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">If you have any questions or need assistance, please contact our support team.</p>
          </div>
        </div>
        <div style="background: #f9fafb; padding: 15px 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 11px; color: #9ca3af;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Zellavora. All rights reserved.</p>
        </div>
      </div>
    `,
  }),

  passwordResetEmail: (resetLink: string, expiryHours: number = 1) => ({
    subject: 'Reset Your ZCC Password',
    text: `Click this link to reset your password: ${resetLink}. This link expires in ${expiryHours} hour(s).`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px;">Password Reset Request</h2>
        </div>
        <div style="padding: 30px 20px;">
          <p style="color: #374151; font-size: 16px;">We received a request to reset your password. Click the button below to create a new password.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: #6366f1; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Or copy this link: ${resetLink}</p>
          <div style="border-top: 1px solid #e5e7eb; margin: 20px 0; padding-top: 20px;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">This link will expire in ${expiryHours} hour(s). If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        </div>
        <div style="background: #f9fafb; padding: 15px 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 11px; color: #9ca3af;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Zellavora. All rights reserved.</p>
        </div>
      </div>
    `,
  }),

  userInvitation: (invitationLink: string, invitedBy: string, tenantName: string) => ({
    subject: `You're invited to join ${tenantName} on ZCC`,
    text: `${invitedBy} has invited you to join ${tenantName} on Zellavora Control Center. Click the link to accept: ${invitationLink}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px;">You're Invited!</h2>
        </div>
        <div style="padding: 30px 20px;">
          <p style="color: #374151; font-size: 16px;"><strong>${invitedBy}</strong> has invited you to join <strong>${tenantName}</strong> on Zellavora Control Center.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" style="background: #6366f1; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Or copy this link: ${invitationLink}</p>
          <div style="border-top: 1px solid #e5e7eb; margin: 20px 0; padding-top: 20px;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore it.</p>
          </div>
        </div>
        <div style="background: #f9fafb; padding: 15px 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 11px; color: #9ca3af;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Zellavora. All rights reserved.</p>
        </div>
      </div>
    `,
  }),

  twoFactorCode: (code: string, expiryMinutes: number = 5) => ({
    subject: '2FA Code for ZCC',
    text: `Your two-factor authentication code is: ${code}. Valid for ${expiryMinutes} minutes.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px;">Two-Factor Authentication</h2>
        </div>
        <div style="padding: 30px 20px;">
          <p style="color: #374151; font-size: 16px;">Your authentication code is:</p>
          <div style="font-size: 48px; font-weight: bold; color: #4f46e5; letter-spacing: 8px; padding: 20px 0; text-align: center; background: #f3f4f6; border-radius: 8px; margin: 20px 0;">${code}</div>
          <p style="color: #6b7280; font-size: 14px;">This code is valid for ${expiryMinutes} minutes.</p>
          <div style="border-top: 1px solid #e5e7eb; margin: 20px 0; padding-top: 20px;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">If you didn't attempt to log in, your account may be compromised. Please change your password immediately.</p>
          </div>
        </div>
        <div style="background: #f9fafb; padding: 15px 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 11px; color: #9ca3af;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Zellavora. All rights reserved.</p>
        </div>
      </div>
    `,
  }),

  accountSecurityAlert: (alertType: string, timestamp: string) => ({
    subject: 'ZCC Account Security Alert',
    text: `A security event occurred on your ZCC account. Alert: ${alertType} at ${timestamp}. If this wasn't you, please change your password immediately.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #fee2e2; border-radius: 8px; background: #fef2f2;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px;">⚠️ Security Alert</h2>
        </div>
        <div style="padding: 30px 20px;">
          <p style="color: #7f1d1d; font-size: 16px; font-weight: 600;">We detected unusual activity on your account</p>
          <p style="color: #7f1d1d; font-size: 14px;">Alert Type: <strong>${alertType}</strong></p>
          <p style="color: #7f1d1d; font-size: 14px;">Time: <strong>${timestamp}</strong></p>
          <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="color: #7f1d1d; font-size: 12px; margin: 0;">If this was not you, please change your password immediately and contact our security team.</p>
          </div>
        </div>
        <div style="background: #fef2f2; padding: 15px 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 11px; color: #9ca3af;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Zellavora. All rights reserved.</p>
        </div>
      </div>
    `,
  }),
};
