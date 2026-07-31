# Enterprise Registration Flow - 13-Step Implementation
## Aligned with Complete Specification

**Status**: ✅ **Backend 100%** | ✅ **Store 100%** | 🔄 **Template 0%**  
**Last Updated**: 2026-07-31  
**Commit**: `b44873f` - Refactored to 13-step specification

---

## 📋 The 13-Step Flow (Per Specification)

### **Step 1: Welcome / Landing Page**
- Display registration welcome screen
- Buttons: Login, Register Organization, Contact Sales, Forgot Password
- Transition to Step 2

### **Step 2: Registration Type Selection**
- Choose registration type: "Create New Organization" or "Join Existing"
- Optional: Enter invitation code if available
- Methods: `selectRegistrationType()`, `verifyInvitationCode()`, `skipInvitationCode()`

### **Step 3: Basic Information (Personal Details)**
- **Fields Required**:
  - First Name (2-50 chars)
  - Last Name (2-50 chars)
  - Display Name (optional, 100 chars)
  - Email (unique, validated against `/api/v1/register/check-email`)
  - Mobile Number (for OTP)
  - Country (dropdown)
  - Timezone (auto-detected, editable)
  - Preferred Language (dropdown)
- **Form**: `basicInfoForm`
- **Method**: `saveBasicInfo()`

### **Step 4: Email Verification**
- Send 6-digit OTP to email
- 15-minute expiry, 60-second cooldown, max 5 resends/hour
- **Methods**:
  - `sendEmailOtp()` - Send OTP
  - `verifyEmailOtp()` - Verify code
  - `resendEmailOtp()` - Resend with cooldown
- **OTP Input**: `emailOtpCodeInput` signal
- **Timer**: `emailTimer` signal (counts down from 900 seconds)

### **Step 5: Mobile Verification (Optional)**
- Send SMS OTP to mobile number
- Same requirements as email OTP (6 digits, 15-min expiry, etc.)
- **Methods**:
  - `sendMobileOtp()` - Send SMS OTP
  - `skipMobileVerification()` - Skip if optional
- **OTP Input**: `mobileOtpCode` signal
- **Timer**: `mobileTimer` signal

### **Step 6: Organization Information**
- **Fields**:
  - Organization Name (required, 2-100 chars)
  - Organization Code (required, 2-16 alphanumeric + hyphens, auto-generate or manual)
  - Industry (dropdown: Healthcare, Banking, IT, Finance, etc.)
  - Organization Size (1-10, 10-50, 50-100, 100-500, 500+)
  - Website (optional, URL format)
  - GST Number (optional)
  - Tax Number (optional)
  - Logo Upload (drag-drop)
  - Use Cases (multi-select)
- **Backend Validation**:
  - Email uniqueness: `/api/v1/register/check-email`
  - Org code uniqueness: `/api/v1/register/check-org`
- **Methods**:
  - `checkOrgCode()` - Validate availability
  - `onLogoUploaded()` - Handle logo upload
  - `saveOrganizationInfo()` - Save org data
- **Form**: `organizationForm`

### **Step 7: Branch Setup (Head Office)**
- **Fields**:
  - Branch Name (default: "Head Office")
  - Address (optional)
  - City (optional)
  - State (optional)
  - Country (required)
  - Pincode (optional)
- **Method**: `saveBranchInfo()`
- **Form**: `branchForm`

### **Step 8: Password Creation**
- **Requirements**:
  - Minimum 12 characters
  - Must contain: uppercase, lowercase, numbers, special characters
  - Cannot reuse previous passwords
  - Password strength meter (weak/fair/good/strong/excellent)
- **Fields**:
  - Password
  - Confirm Password
- **Validation**: Backend validates with password strength rules
- **Method**: `savePassword()`
- **Form**: `passwordForm`

### **Step 9: Security Setup (MFA)**
- **MFA Method Selection**:
  - ☑ Email OTP (default, recommended)
  - ☐ Authenticator App (TOTP)
  - ☐ SMS OTP
- **If Authenticator Selected**:
  - Display TOTP secret + QR code
  - Instructions for Google Authenticator, Authy, etc.
- **Methods**:
  - `selectMfaMethod()` - Choose method
  - `loadMfaSetup()` - Load TOTP setup
- **Form**: `mfaForm`

### **Step 10: Terms & Privacy**
- **Checkboxes**:
  - ✓ I agree to Terms of Service (required)
  - ✓ I agree to Privacy Policy (required)
  - ☐ I agree to Cookie Policy (optional)
  - ☐ Receive Security Alerts (default: true)
  - ☐ Receive Marketing Emails (default: false)
- **CAPTCHA**: (Optional, implement if needed)
- **Method**: `saveTermsAndPrivacy()`
- **Form**: `termsForm`

### **Step 11: Review & Confirmation**
- Display complete summary:
  - Owner Name (First + Last)
  - Email
  - Organization Name
  - Organization Code
  - Industry
  - Country
  - Branch Name
  - Use Cases
- **Method**: `getRegistrationSummary()` - Retrieve all data
- **Actions**: Back or Create Account

### **Step 12: Account Creation (Backend Processing)**
- Transition triggered by `confirmAndCreateAccount()`
- Backend processes:
  1. Validate all data
  2. Create Organization (atomic transaction)
  3. Create Branch
  4. Create User (Owner role)
  5. Assign Owner Role
  6. Create User-Tenant membership
  7. Create Role Assignment
  8. Create Profile
  9. Create Workspace
  10. Create Default Settings
  11. Create Audit Log
  12. Store password in history
  13. Send welcome email (async queue)
- **Method**: `store.submitRegistration()` calls `/api/v1/register/complete`

### **Step 13: Welcome Screen**
- Display success message: "Organization Created Successfully"
- Show owner name: "Welcome, [First Name]"
- Checklist of completed items:
  - ✅ Email Verified
  - ✅ Organization Created
  - ✅ Branch Created
  - ✅ Admin User Created
  - ✅ Workspace Ready
- **Button**: "Go To Dashboard"
- **Methods**: `navigateToDashboard()`, `navigateToLogin()`

---

## 🔧 State Management - RegisterStore

### RegisterState Interface
```typescript
{
  // Navigation
  currentStep: number;           // 1-13
  registrationType: 'new_org' | 'invite' | null;

  // Step 3: Personal Info
  firstName, lastName, displayName, email, mobile, country, timezone, language

  // Step 4: Email Verification
  emailOtpCode: string;
  emailVerified: boolean;

  // Step 5: Mobile Verification
  mobileOtpCode: string;
  mobileVerified: boolean;

  // Step 6: Organization
  organizationName, organizationCode, industry, organizationSize
  website, gstNumber, taxNumber, logoUrl
  useCases: string[]

  // Step 7: Branch
  branchName, branchAddress, branchCity, branchState, branchCountry, branchPincode

  // Step 8: Password
  password, confirmPassword

  // Step 9: MFA
  mfaMethod: 'email_otp' | 'authenticator' | 'sms' | null
  mfaEnabled: boolean
  mfaSecret, mfaQrCode, mfaCode

  // Step 10: Terms
  termsAccepted, privacyAccepted, cookieAccepted
  securityAlertsEnabled, marketingEmails

  // UI States
  loading: boolean
  error: string | null
  successData: any
}
```

### Key Methods
- **Navigation**: `nextStep()`, `prevStep()`, `setStep()`
- **Update Methods**: `setRegistrationType()`, `updatePersonalInfo()`, `updateOrganizationInfo()`, `updateBranchInfo()`, `updatePassword()`, `updateMfaSettings()`, `updateTerms()`
- **API Methods**: `sendEmailOtp()`, `verifyEmailOtp()`, `resendEmailOtp()`, `loadMfaSetup()`, `checkEmailAvailability()`, `checkOrgCodeAvailability()`, `submitRegistration()`
- **Utilities**: `resetForm()`

---

## 📝 Component Methods by Step

### Step 1-2: Registration Type
```typescript
selectRegistrationType(type: 'new_org' | 'invite')
verifyInvitationCode(inviteCode: string)
skipInvitationCode()
```

### Step 3: Basic Information
```typescript
saveBasicInfo()
```

### Step 4: Email OTP
```typescript
sendEmailOtp()
startEmailTimer()
verifyEmailOtp()
resendEmailOtp()
```

### Step 5: Mobile OTP
```typescript
sendMobileOtp()
skipMobileVerification()
```

### Step 6: Organization
```typescript
checkOrgCode()
onLogoUploaded(logoBase64: string)
saveOrganizationInfo()
```

### Step 7: Branch
```typescript
saveBranchInfo()
```

### Step 8: Password
```typescript
savePassword()
```

### Step 9: MFA
```typescript
selectMfaMethod(method)
loadMfaSetup()
```

### Step 10: Terms
```typescript
saveTermsAndPrivacy()
```

### Step 11: Review
```typescript
getRegistrationSummary()
confirmAndCreateAccount()
```

### Navigation
```typescript
navigateToLogin()
navigateToDashboard()
```

---

## 🎯 Form Definitions (ngOnInit)

| Step | Form | Key Fields | Validators |
|------|------|-----------|-----------|
| 3 | `basicInfoForm` | firstName, lastName, email, mobile, country, timezone, language | Required, email, minLength |
| 4 | `emailOtpForm` | emailOtp | 6-digit pattern |
| 5 | `mobileOtpForm` | mobileOtp | 6-digit pattern |
| 6 | `organizationForm` | organizationName, organizationCode, industry, size | Required, pattern |
| 7 | `branchForm` | branchName, branchCountry, etc. | Required, minLength |
| 8 | `passwordForm` | password, confirmPassword | minLength 12 |
| 9 | `mfaForm` | mfaMethod, mfaCode | Required |
| 10 | `termsForm` | termsAccepted, privacyAccepted | RequiredTrue |

---

## 🔌 Backend API Integration

### All Endpoints Called
| Endpoint | Step | Purpose |
|----------|------|---------|
| POST `/api/v1/register/check-email` | 3 | Validate email availability |
| POST `/api/v1/register/check-org` | 6 | Validate org code availability |
| POST `/api/v1/register/send-email-otp` | 4 | Send email OTP |
| POST `/api/v1/register/verify-email` | 4 | Verify email OTP |
| POST `/api/v1/register/resend-otp` | 4 | Resend OTP |
| POST `/api/v1/register/send-mobile-otp` | 5 | Send SMS OTP |
| POST `/api/v1/register/verify-mobile` | 5 | Verify mobile OTP |
| POST `/api/v1/register/mfa-setup` | 9 | Get TOTP secret + QR |
| POST `/api/v1/register/complete` | 12 | Complete registration |

---

## 🎨 Visual Steps Display

```
WELCOME → TYPE → BASIC INFO → EMAIL → MOBILE → ORG → BRANCH → ... → SUCCESS
  👤     📋      👤        📧    📱      🏢     🏬
```

The visual progress bar shows 7 major steps (excluding backend steps 12).

---

## ✅ Implementation Checklist

### Backend
- [x] All 12 API endpoints
- [x] Database schema
- [x] OTP management
- [x] Password validation
- [x] Atomic transactions
- [x] Audit logging

### Store (State Management)
- [x] 13-step state machine
- [x] All selectors
- [x] Update methods
- [x] API integration
- [x] Error handling

### Component - TODO
- [ ] Create register.component.html with 13-step template
- [ ] Implement form bindings
- [ ] Add validation error messages
- [ ] Add loading states
- [ ] Add timer displays
- [ ] Implement step navigation
- [ ] Add visual progress indicator
- [ ] Integrate all methods

---

## 🚀 Next Priority: Frontend Template

**File**: `/apps/admin/src/app/features/auth/components/register/register.component.html`

The template needs to:
1. Display 13 steps with ngSwitch
2. Bind forms to component methods
3. Show validation errors
4. Display OTP timers
5. Show MFA QR code
6. Display review summary
7. Handle loading/success states

**Estimated Time**: 4-6 hours for full implementation + testing

---

## 📊 Data Flow

```
User Input
    ↓
RegisterComponent
    ↓
Form Validation
    ↓
RegisterStore (signal update)
    ↓
API Call (if needed)
    ↓
Store Update
    ↓
UI Re-render (Angular signals)
    ↓
Next Step
```

---

## 🔐 Security Features

- ✅ OTP 6-digit codes with 15-min expiry
- ✅ Rate limiting (60s cooldown, 5/hour limit)
- ✅ Password validation (12+ chars, complexity rules, history)
- ✅ Atomic transactions (all-or-nothing)
- ✅ MFA support (email OTP, TOTP, SMS)
- ✅ Audit logging (IP, user agent, timestamp)
- ✅ Terms acceptance tracking
- ✅ Email verification required

---

**Repository**: Zellavora Control Center  
**Branch**: main  
**Commit**: `b44873f`

