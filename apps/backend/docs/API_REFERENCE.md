# API operation catalog

Canonical URLs and operation names. Historical aliases are listed in [API_NAMING.md](API_NAMING.md). The live contract is available at `/swagger/swagger.json`.

## Access Control

| Method | URL                                                | Name                               | Operation ID                                 |
| ------ | -------------------------------------------------- | ---------------------------------- | -------------------------------------------- |
| GET    | `/api/v1/rbac/audit-logs`                          | Search the RBAC audit log          | `getRbacAuditLogs`                           |
| POST   | `/api/v1/rbac/check`                               | Check multiple permissions         | `postRbacCheck`                              |
| GET    | `/api/v1/rbac/me/policy`                           | Get current user permission policy | `getRbacMePolicy`                            |
| GET    | `/api/v1/rbac/permissions`                         | List all permissions               | `getRbacPermissions`                         |
| GET    | `/api/v1/rbac/permissions/groups`                  | List permission groups             | `getRbacPermissionsGroups`                   |
| GET    | `/api/v1/rbac/roles`                               | List all roles in the tenant       | `getRbacRoles`                               |
| POST   | `/api/v1/rbac/roles`                               | Create role                        | `postRbacRoles`                              |
| DELETE | `/api/v1/rbac/roles/{id}`                          | Delete role                        | `deleteRbacRolesById`                        |
| GET    | `/api/v1/rbac/roles/{id}`                          | Get role detail                    | `getRbacRolesById`                           |
| PATCH  | `/api/v1/rbac/roles/{id}`                          | Update role                        | `patchRbacRolesById`                         |
| POST   | `/api/v1/rbac/roles/{id}/clone`                    | Clone role                         | `postRbacRolesByIdClone`                     |
| PUT    | `/api/v1/rbac/roles/{id}/inheritance`              | Set role inheritance               | `putRbacRolesByIdInheritance`                |
| PUT    | `/api/v1/rbac/roles/{id}/permissions`              | Replace role permissions           | `putRbacRolesByIdPermissions`                |
| GET    | `/api/v1/rbac/users/{userId}/roles`                | List role assignments for user     | `getRbacUsersByUserIdRoles`                  |
| POST   | `/api/v1/rbac/users/{userId}/roles`                | Assign role to user                | `postRbacUsersByUserIdRoles`                 |
| DELETE | `/api/v1/rbac/users/{userId}/roles/{assignmentId}` | Revoke role assignment from user   | `deleteRbacUsersByUserIdRolesByAssignmentId` |

## Administration - Audit Logs

| Method | URL                                | Name                          | Operation ID                |
| ------ | ---------------------------------- | ----------------------------- | --------------------------- |
| POST   | `/api/v1/admin/audit-logs/details` | Load audit log details        | `postAdminAuditLogsDetails` |
| GET    | `/api/v1/admin/audit-logs/search`  | Get audit log search template | `getAdminAuditLogsSearch`   |
| POST   | `/api/v1/admin/audit-logs/search`  | Search audit logs             | `postAdminAuditLogsSearch`  |

## Administration - Branches

| Method | URL                               | Name                        | Operation ID               |
| ------ | --------------------------------- | --------------------------- | -------------------------- |
| POST   | `/api/v1/admin/branches/delete`   | Delete branch               | `postAdminBranchesDelete`  |
| POST   | `/api/v1/admin/branches/details`  | Load branch details         | `postAdminBranchesDetails` |
| POST   | `/api/v1/admin/branches/save`     | Save branch details         | `postAdminBranchesSave`    |
| GET    | `/api/v1/admin/branches/search`   | Get branch search template  | `getAdminBranchesSearch`   |
| POST   | `/api/v1/admin/branches/search`   | Search branch               | `postAdminBranchesSearch`  |
| GET    | `/api/v1/admin/branches/template` | Get template for new branch | `getAdminBranchesTemplate` |

## Administration - Configuration

| Method | URL                                    | Name                              | Operation ID                     |
| ------ | -------------------------------------- | --------------------------------- | -------------------------------- |
| POST   | `/api/v1/admin/configurations/delete`  | Delete configuration              | `postAdminConfigurationsDelete`  |
| POST   | `/api/v1/admin/configurations/details` | Load configuration details        | `postAdminConfigurationsDetails` |
| POST   | `/api/v1/admin/configurations/list`    | Load all configurations           | `postAdminConfigurationsList`    |
| POST   | `/api/v1/admin/configurations/save`    | Save configuration details        | `postAdminConfigurationsSave`    |
| GET    | `/api/v1/admin/configurations/search`  | Get configuration search template | `getAdminConfigurationsSearch`   |
| POST   | `/api/v1/admin/configurations/search`  | Search configurations             | `postAdminConfigurationsSearch`  |
| GET    | `/api/v1/admin/regions/metadata`       | Get regional initial metadata     | `getAdminRegionsMetadata`        |

## Administration - Groups

| Method | URL                            | Name                      | Operation ID             |
| ------ | ------------------------------ | ------------------------- | ------------------------ |
| POST   | `/api/v1/admin/groups/delete`  | Delete group              | `postAdminGroupsDelete`  |
| POST   | `/api/v1/admin/groups/details` | Load group details        | `postAdminGroupsDetails` |
| POST   | `/api/v1/admin/groups/save`    | Save group details        | `postAdminGroupsSave`    |
| GET    | `/api/v1/admin/groups/search`  | Get group search template | `getAdminGroupsSearch`   |
| POST   | `/api/v1/admin/groups/search`  | Search groups             | `postAdminGroupsSearch`  |

## Administration - Messages

| Method | URL                           | Name         | Operation ID            |
| ------ | ----------------------------- | ------------ | ----------------------- |
| POST   | `/api/v1/admin/emails/send`   | Send email   | `postAdminEmailsSend`   |
| POST   | `/api/v1/admin/messages/send` | Send message | `postAdminMessagesSend` |

## Administration - Resources

| Method | URL                                 | Name                          | Operation ID                 |
| ------ | ----------------------------------- | ----------------------------- | ---------------------------- |
| POST   | `/api/v1/admin/resources/bulk-save` | Save list of resources        | `postAdminResourcesBulkSave` |
| POST   | `/api/v1/admin/resources/delete`    | Delete resource               | `postAdminResourcesDelete`   |
| POST   | `/api/v1/admin/resources/details`   | Load resource details by ID   | `postAdminResourcesDetails`  |
| GET    | `/api/v1/admin/resources/metadata`  | Initialize resource metadata  | `getAdminResourcesMetadata`  |
| POST   | `/api/v1/admin/resources/save`      | Save resource details         | `postAdminResourcesSave`     |
| GET    | `/api/v1/admin/resources/search`    | Get resource search template  | `getAdminResourcesSearch`    |
| POST   | `/api/v1/admin/resources/search`    | Search resources              | `postAdminResourcesSearch`   |
| GET    | `/api/v1/admin/resources/template`  | Get template for new resource | `getAdminResourcesTemplate`  |

## Administration - Roles

| Method | URL                                             | Name                        | Operation ID                            |
| ------ | ----------------------------------------------- | --------------------------- | --------------------------------------- |
| POST   | `/api/v1/admin/roles/delete`                    | Delete role                 | `postAdminRolesDelete`                  |
| POST   | `/api/v1/admin/roles/details`                   | Load role details by ID     | `postAdminRolesDetails`                 |
| GET    | `/api/v1/admin/roles/metadata`                  | Initialize role metadata    | `getAdminRolesMetadata`                 |
| POST   | `/api/v1/admin/roles/resource-mappings/details` | Load role resource mappings | `postAdminRolesResourceMappingsDetails` |
| POST   | `/api/v1/admin/roles/resource-mappings/save`    | Save role resource mappings | `postAdminRolesResourceMappingsSave`    |
| POST   | `/api/v1/admin/roles/save`                      | Save role details           | `postAdminRolesSave`                    |
| GET    | `/api/v1/admin/roles/search`                    | Get role search template    | `getAdminRolesSearch`                   |
| POST   | `/api/v1/admin/roles/search`                    | Search roles                | `postAdminRolesSearch`                  |
| GET    | `/api/v1/admin/roles/template`                  | Get template for new role   | `getAdminRolesTemplate`                 |

## Administration - Users

| Method | URL                                       | Name                           | Operation ID                      |
| ------ | ----------------------------------------- | ------------------------------ | --------------------------------- |
| GET    | `/api/v1/admin/users/assignable-roles`    | Get roles assignable to user   | `getAdminUsersAssignableRoles`    |
| POST   | `/api/v1/admin/users/branch-options`      | Load branch dropdown details   | `postAdminUsersBranchOptions`     |
| POST   | `/api/v1/admin/users/details`             | Load user details by serial ID | `postAdminUsersDetails`           |
| GET    | `/api/v1/admin/users/metadata`            | Initialize user data           | `getAdminUsersMetadata`           |
| POST   | `/api/v1/admin/users/save`                | Save user details              | `postAdminUsersSave`              |
| GET    | `/api/v1/admin/users/search`              | Get user search template       | `getAdminUsersSearch`             |
| POST   | `/api/v1/admin/users/search`              | Search users                   | `postAdminUsersSearch`            |
| POST   | `/api/v1/admin/users/team-members/search` | Get team users                 | `postAdminUsersTeamMembersSearch` |
| GET    | `/api/v1/admin/users/template`            | Get template for new user      | `getAdminUsersTemplate`           |

## Audit Logs

| Method | URL                      | Name               | Operation ID       |
| ------ | ------------------------ | ------------------ | ------------------ |
| GET    | `/api/v1/audit-logs`     | List audit logs    | `getAuditLogs`     |
| POST   | `/api/v1/audit-logs/log` | Create audit event | `postAuditLogsLog` |

## Authentication

| Method | URL                                 | Name                                                | Operation ID                    |
| ------ | ----------------------------------- | --------------------------------------------------- | ------------------------------- |
| POST   | `/api/v1/auth/change-password`      | Change account password                             | `postAuthChangePassword`        |
| GET    | `/api/v1/auth/clients`              | List active tenants                                 | `getAuthClients`                |
| POST   | `/api/v1/auth/debug/check-user`     | Check user authentication configuration             | `postAuthDebugCheckUser`        |
| GET    | `/api/v1/auth/encryption-key`       | Get payload encryption key                          | `getAuthEncryptionKey`          |
| POST   | `/api/v1/auth/forgot-password`      | Send password reset email                           | `postAuthForgotPassword`        |
| POST   | `/api/v1/auth/login`                | Sign in with email and password                     | `postAuthLogin`                 |
| POST   | `/api/v1/auth/login/mfa`            | Complete MFA challenge                              | `postAuthLoginMfa`              |
| POST   | `/api/v1/auth/logout`               | Revoke current session                              | `postAuthLogout`                |
| POST   | `/api/v1/auth/logout-all`           | Revoke all sessions for the current user            | `postAuthLogoutAll`             |
| GET    | `/api/v1/auth/me`                   | Get current user profile with permissions and menu  | `getAuthMe`                     |
| POST   | `/api/v1/auth/mfa/confirm`          | Confirm TOTP enrollment                             | `postAuthMfaConfirm`            |
| POST   | `/api/v1/auth/mfa/disable`          | Disable MFA                                         | `postAuthMfaDisable`            |
| POST   | `/api/v1/auth/mfa/enroll`           | Start TOTP enrollment                               | `postAuthMfaEnroll`             |
| POST   | `/api/v1/auth/mfa/recovery-codes`   | Regenerate MFA recovery codes                       | `postAuthMfaRecoveryCodes`      |
| GET    | `/api/v1/auth/oauth/{provider}`     | Start OAuth sign-in                                 | `getAuthOauthByProvider`        |
| GET    | `/api/v1/auth/oauth/callback`       | Handle OAuth callback                               | `getAuthOauthCallback`          |
| POST   | `/api/v1/auth/refresh`              | Refresh access and refresh tokens                   | `postAuthRefresh`               |
| POST   | `/api/v1/auth/resend-otp`           | Resend email verification OTP                       | `postAuthResendOtp`             |
| POST   | `/api/v1/auth/reset-password`       | Reset account password                              | `postAuthResetPassword`         |
| POST   | `/api/v1/auth/send-verification`    | Send or resend email verification code              | `postAuthSendVerification`      |
| DELETE | `/api/v1/auth/sessions`             | Revoke all sessions except the current one          | `deleteAuthSessions`            |
| GET    | `/api/v1/auth/sessions`             | List all active sessions for the authenticated user | `getAuthSessions`               |
| DELETE | `/api/v1/auth/sessions/{sessionId}` | Revoke session                                      | `deleteAuthSessionsBySessionId` |
| POST   | `/api/v1/auth/switch-tenant`        | Switch active tenant                                | `postAuthSwitchTenant`          |
| GET    | `/api/v1/auth/tenants`              | List tenants the current user belongs to            | `getAuthTenants`                |
| POST   | `/api/v1/auth/validate-client`      | Validate tenant code                                | `postAuthValidateClient`        |
| POST   | `/api/v1/auth/verify-email`         | Verify email with token or OTP code                 | `postAuthVerifyEmail`           |

## Branches

| Method | URL                     | Name             | Operation ID      |
| ------ | ----------------------- | ---------------- | ----------------- |
| GET    | `/api/v1/branches`      | List branches    | `getBranches`     |
| POST   | `/api/v1/branches`      | Create branch    | `postBranches`    |
| GET    | `/api/v1/branches/{id}` | Get branch by ID | `getBranchesById` |
| PUT    | `/api/v1/branches/{id}` | Update branch    | `putBranchesById` |

## Daily Sheets

| Method | URL                                 | Name                  | Operation ID                 |
| ------ | ----------------------------------- | --------------------- | ---------------------------- |
| GET    | `/api/v1/daily-sheets`              | List daily sheets     | `getDailySheets`             |
| POST   | `/api/v1/daily-sheets`              | Create daily sheet    | `postDailySheets`            |
| DELETE | `/api/v1/daily-sheets/{id}`         | Delete daily sheet    | `deleteDailySheetsById`      |
| GET    | `/api/v1/daily-sheets/{id}`         | Get daily sheet by ID | `getDailySheetsById`         |
| PUT    | `/api/v1/daily-sheets/{id}`         | Update daily sheet    | `putDailySheetsById`         |
| POST   | `/api/v1/daily-sheets/{id}/approve` | Approve daily sheet   | `postDailySheetsByIdApprove` |
| POST   | `/api/v1/daily-sheets/{id}/submit`  | Submit daily sheet    | `postDailySheetsByIdSubmit`  |

## Dashboard

| Method | URL                          | Name                   | Operation ID           |
| ------ | ---------------------------- | ---------------------- | ---------------------- |
| GET    | `/api/v1/dashboard/activity` | Get dashboard activity | `getDashboardActivity` |
| GET    | `/api/v1/dashboard/overview` | Get dashboard overview | `getDashboardOverview` |

## Email

| Method | URL                                 | Name                                | Operation ID                 |
| ------ | ----------------------------------- | ----------------------------------- | ---------------------------- |
| GET    | `/api/v1/email/health`              | Check email service health          | `getEmailHealth`             |
| POST   | `/api/v1/email/send-2fa-code`       | Send two-factor authentication code | `postEmailSend2faCode`       |
| POST   | `/api/v1/email/send-invitation`     | Send user invitation email          | `postEmailSendInvitation`    |
| POST   | `/api/v1/email/send-otp`            | Send OTP email                      | `postEmailSendOtp`           |
| POST   | `/api/v1/email/send-password-reset` | Send password reset email           | `postEmailSendPasswordReset` |
| POST   | `/api/v1/email/send-security-alert` | Send security alert email           | `postEmailSendSecurityAlert` |
| POST   | `/api/v1/email/send-verification`   | Send email verification             | `postEmailSendVerification`  |
| POST   | `/api/v1/email/send-welcome`        | Send welcome email                  | `postEmailSendWelcome`       |

## IAM - Groups

| Method | URL                                        | Name                | Operation ID                         |
| ------ | ------------------------------------------ | ------------------- | ------------------------------------ |
| GET    | `/api/v1/iam/groups`                       | List groups         | `getIamGroups`                       |
| POST   | `/api/v1/iam/groups`                       | Create group        | `postIamGroups`                      |
| DELETE | `/api/v1/iam/groups/{id}`                  | Delete group        | `deleteIamGroupsById`                |
| GET    | `/api/v1/iam/groups/{id}`                  | Get group by ID     | `getIamGroupsById`                   |
| PATCH  | `/api/v1/iam/groups/{id}`                  | Update group        | `patchIamGroupsById`                 |
| POST   | `/api/v1/iam/groups/{id}/members`          | Add group members   | `postIamGroupsByIdMembers`           |
| DELETE | `/api/v1/iam/groups/{id}/members/{userId}` | Remove group member | `deleteIamGroupsByIdMembersByUserId` |
| PUT    | `/api/v1/iam/groups/{id}/roles`            | Set group roles     | `putIamGroupsByIdRoles`              |
| GET    | `/api/v1/iam/groups/tree`                  | Get group hierarchy | `getIamGroupsTree`                   |

## IAM - Resources

| Method | URL                                             | Name                   | Operation ID                              |
| ------ | ----------------------------------------------- | ---------------------- | ----------------------------------------- |
| GET    | `/api/v1/iam/resources`                         | List resources         | `getIamResources`                         |
| POST   | `/api/v1/iam/resources`                         | Create resource        | `postIamResources`                        |
| DELETE | `/api/v1/iam/resources/{id}`                    | Delete resource        | `deleteIamResourcesById`                  |
| GET    | `/api/v1/iam/resources/{id}`                    | Get resource by ID     | `getIamResourcesById`                     |
| PATCH  | `/api/v1/iam/resources/{id}`                    | Update resource        | `patchIamResourcesById`                   |
| POST   | `/api/v1/iam/resources/{id}/actions`            | Add resource action    | `postIamResourcesByIdActions`             |
| DELETE | `/api/v1/iam/resources/{id}/actions/{actionId}` | Remove resource action | `deleteIamResourcesByIdActionsByActionId` |
| GET    | `/api/v1/iam/resources/key/{key}`               | Get resource by key    | `getIamResourcesKeyByKey`                 |
| GET    | `/api/v1/iam/resources/tree`                    | Get resource hierarchy | `getIamResourcesTree`                     |

## IAM - Roles

| Method | URL                                  | Name                  | Operation ID                 |
| ------ | ------------------------------------ | --------------------- | ---------------------------- |
| GET    | `/api/v1/iam/roles`                  | List roles            | `getIamRoles`                |
| POST   | `/api/v1/iam/roles`                  | Create role           | `postIamRoles`               |
| DELETE | `/api/v1/iam/roles/{id}`             | Delete role           | `deleteIamRolesById`         |
| GET    | `/api/v1/iam/roles/{id}`             | Get role by ID        | `getIamRolesById`            |
| PATCH  | `/api/v1/iam/roles/{id}`             | Update role           | `patchIamRolesById`          |
| POST   | `/api/v1/iam/roles/{id}/copy`        | Copy role             | `postIamRolesByIdCopy`       |
| GET    | `/api/v1/iam/roles/{id}/permissions` | List role permissions | `getIamRolesByIdPermissions` |
| PUT    | `/api/v1/iam/roles/{id}/permissions` | Set role permissions  | `putIamRolesByIdPermissions` |
| GET    | `/api/v1/iam/roles/all`              | List all roles        | `getIamRolesAll`             |

## IAM - Users

| Method | URL                             | Name            | Operation ID             |
| ------ | ------------------------------- | --------------- | ------------------------ |
| GET    | `/api/v1/iam/users`             | List users      | `getIamUsers`            |
| POST   | `/api/v1/iam/users`             | Create user     | `postIamUsers`           |
| DELETE | `/api/v1/iam/users/{id}`        | Delete user     | `deleteIamUsersById`     |
| GET    | `/api/v1/iam/users/{id}`        | Get user by ID  | `getIamUsersById`        |
| PATCH  | `/api/v1/iam/users/{id}`        | Update user     | `patchIamUsersById`      |
| PUT    | `/api/v1/iam/users/{id}/groups` | Set user groups | `putIamUsersByIdGroups`  |
| POST   | `/api/v1/iam/users/{id}/lock`   | Lock user       | `postIamUsersByIdLock`   |
| PUT    | `/api/v1/iam/users/{id}/roles`  | Set user roles  | `putIamUsersByIdRoles`   |
| PUT    | `/api/v1/iam/users/{id}/status` | Set user status | `putIamUsersByIdStatus`  |
| POST   | `/api/v1/iam/users/{id}/unlock` | Unlock user     | `postIamUsersByIdUnlock` |

## Identity Authentication

| Method | URL                               | Name                   | Operation ID               |
| ------ | --------------------------------- | ---------------------- | -------------------------- |
| POST   | `/api/v1/identity/auth/login`     | Sign in                | `postIdentityAuthLogin`    |
| POST   | `/api/v1/identity/auth/login/mfa` | Complete MFA challenge | `postIdentityAuthLoginMfa` |
| POST   | `/api/v1/identity/auth/refresh`   | Refresh tokens         | `postIdentityAuthRefresh`  |

## Invitations

| Method | URL                            | Name                | Operation ID              |
| ------ | ------------------------------ | ------------------- | ------------------------- |
| POST   | `/api/v1/invitations/generate` | Generate invitation | `postInvitationsGenerate` |
| POST   | `/api/v1/invitations/verify`   | Verify invitation   | `postInvitationsVerify`   |

## Lookups

| Method | URL                      | Name                      | Operation ID       |
| ------ | ------------------------ | ------------------------- | ------------------ |
| GET    | `/api/v1/lookups`        | List lookup data          | `getLookups`       |
| GET    | `/api/v1/lookups/{type}` | List lookup data by type  | `getLookupsByType` |
| GET    | `/api/v1/lookups/types`  | List lookup data by types | `getLookupsTypes`  |

## Monthly Sheets

| Method | URL                                     | Name                       | Operation ID                    |
| ------ | --------------------------------------- | -------------------------- | ------------------------------- |
| GET    | `/api/v1/monthly-sheets`                | List monthly sheets        | `getMonthlySheets`              |
| POST   | `/api/v1/monthly-sheets`                | Create monthly sheet       | `postMonthlySheets`             |
| DELETE | `/api/v1/monthly-sheets/{id}`           | Delete monthly sheet       | `deleteMonthlySheetsById`       |
| GET    | `/api/v1/monthly-sheets/{id}`           | Get monthly sheet by ID    | `getMonthlySheetsById`          |
| PUT    | `/api/v1/monthly-sheets/{id}`           | Update monthly sheet       | `putMonthlySheetsById`          |
| POST   | `/api/v1/monthly-sheets/{id}/approve`   | Approve monthly sheet      | `postMonthlySheetsByIdApprove`  |
| POST   | `/api/v1/monthly-sheets/{id}/mark-paid` | Mark monthly sheet as paid | `postMonthlySheetsByIdMarkPaid` |
| POST   | `/api/v1/monthly-sheets/{id}/submit`    | Submit monthly sheet       | `postMonthlySheetsByIdSubmit`   |

## Notifications

| Method | URL                          | Name               | Operation ID            |
| ------ | ---------------------------- | ------------------ | ----------------------- |
| GET    | `/api/v1/notifications`      | List notifications | `getNotifications`      |
| POST   | `/api/v1/notifications/send` | Send notification  | `postNotificationsSend` |

## Organization Settings

| Method | URL                                   | Name                            | Operation ID                   |
| ------ | ------------------------------------- | ------------------------------- | ------------------------------ |
| GET    | `/api/v1/organization-settings`       | List organization settings      | `getOrganizationSettings`      |
| POST   | `/api/v1/organization-settings`       | Save organization setting       | `postOrganizationSettings`     |
| GET    | `/api/v1/organization-settings/{key}` | Get organization setting by key | `getOrganizationSettingsByKey` |

## Organizations

| Method | URL                          | Name                   | Operation ID           |
| ------ | ---------------------------- | ---------------------- | ---------------------- |
| POST   | `/api/v1/organizations`      | Create organization    | `postOrganizations`    |
| GET    | `/api/v1/organizations/{id}` | Get organization by ID | `getOrganizationsById` |
| PUT    | `/api/v1/organizations/{id}` | Update organization    | `putOrganizationsById` |

## Permissions

| Method | URL                          | Name              | Operation ID            |
| ------ | ---------------------------- | ----------------- | ----------------------- |
| GET    | `/api/v1/permissions`        | List permissions  | `getPermissions`        |
| POST   | `/api/v1/permissions`        | Create permission | `postPermissions`       |
| POST   | `/api/v1/permissions/assign` | Assign permission | `postPermissionsAssign` |

## Portfolio

| Method | URL                         | Name                             | Operation ID             |
| ------ | --------------------------- | -------------------------------- | ------------------------ |
| GET    | `/api/v1/education`         | List education entries for user  | `getEducation`           |
| POST   | `/api/v1/education`         | Create education entry           | `postEducation`          |
| DELETE | `/api/v1/education/{id}`    | Delete education entry           | `deleteEducationById`    |
| PUT    | `/api/v1/education/{id}`    | Update education entry           | `putEducationById`       |
| GET    | `/api/v1/experience`        | List experience entries for user | `getExperience`          |
| POST   | `/api/v1/experience`        | Create experience entry          | `postExperience`         |
| DELETE | `/api/v1/experience/{id}`   | Delete experience entry          | `deleteExperienceById`   |
| PUT    | `/api/v1/experience/{id}`   | Update experience entry          | `putExperienceById`      |
| GET    | `/api/v1/profile`           | Get user profile                 | `getProfile`             |
| PUT    | `/api/v1/profile`           | Update current user profile      | `putProfile`             |
| GET    | `/api/v1/services`          | List services for user           | `getServices`            |
| POST   | `/api/v1/services`          | Create service                   | `postServices`           |
| DELETE | `/api/v1/services/{id}`     | Delete service                   | `deleteServicesById`     |
| PUT    | `/api/v1/services/{id}`     | Update service                   | `putServicesById`        |
| GET    | `/api/v1/skills`            | List skills for user             | `getSkills`              |
| POST   | `/api/v1/skills`            | Create skill                     | `postSkills`             |
| DELETE | `/api/v1/skills/{id}`       | Delete skill                     | `deleteSkillsById`       |
| PUT    | `/api/v1/skills/{id}`       | Update skill                     | `putSkillsById`          |
| GET    | `/api/v1/testimonials`      | List testimonials for user       | `getTestimonials`        |
| POST   | `/api/v1/testimonials`      | Create testimonial               | `postTestimonials`       |
| DELETE | `/api/v1/testimonials/{id}` | Delete testimonial               | `deleteTestimonialsById` |
| PUT    | `/api/v1/testimonials/{id}` | Update testimonial               | `putTestimonialsById`    |

## Project Gallery

| Method | URL                                              | Name                               | Operation ID                                |
| ------ | ------------------------------------------------ | ---------------------------------- | ------------------------------------------- |
| GET    | `/api/v1/projects/{projectId}/gallery`           | Get all gallery images for project | `getProjectsByProjectIdGallery`             |
| POST   | `/api/v1/projects/{projectId}/gallery`           | Upload gallery image to project    | `postProjectsByProjectIdGallery`            |
| DELETE | `/api/v1/projects/{projectId}/gallery/{imageId}` | Delete gallery item                | `deleteProjectsByProjectIdGalleryByImageId` |
| PUT    | `/api/v1/projects/{projectId}/gallery/{imageId}` | Update gallery item                | `putProjectsByProjectIdGalleryByImageId`    |

## Projects

| Method | URL                             | Name                | Operation ID              |
| ------ | ------------------------------- | ------------------- | ------------------------- |
| GET    | `/api/v1/projects`              | List projects       | `getProjects`             |
| POST   | `/api/v1/projects`              | Create project      | `postProjects`            |
| DELETE | `/api/v1/projects/{id}`         | Delete project      | `deleteProjectsById`      |
| GET    | `/api/v1/projects/{id}`         | Get project by ID   | `getProjectsById`         |
| PUT    | `/api/v1/projects/{id}`         | Update project      | `putProjectsById`         |
| POST   | `/api/v1/projects/{id}/archive` | Archive project     | `postProjectsByIdArchive` |
| POST   | `/api/v1/projects/{id}/publish` | Publish project     | `postProjectsByIdPublish` |
| GET    | `/api/v1/projects/slug/{slug}`  | Get project by slug | `getProjectsSlugBySlug`   |

## Registration

| Method | URL                                                    | Name                                 | Operation ID                                    |
| ------ | ------------------------------------------------------ | ------------------------------------ | ----------------------------------------------- |
| GET    | `/api/v1/auth/registrations/mfa-setup`                 | Generate MFA setup                   | `getAuthRegistrationsMfaSetup`                  |
| POST   | `/api/v1/auth/registrations/send-email-otp`            | Send registration email OTP          | `postAuthRegistrationsSendEmailOtp`             |
| POST   | `/api/v1/auth/registrations/submit`                    | Submit registration                  | `postAuthRegistrationsSubmit`                   |
| POST   | `/api/v1/auth/registrations/verify-email-otp`          | Verify registration email OTP        | `postAuthRegistrationsVerifyEmailOtp`           |
| POST   | `/api/v1/auth/registrations/verify-invitation`         | Verify invitation code               | `postAuthRegistrationsVerifyInvitation`         |
| POST   | `/api/v1/registrations/complete`                       | Complete registration                | `postRegistrationsComplete`                     |
| POST   | `/api/v1/registrations/email-availability`             | Check email availability             | `postRegistrationsEmailAvailability`            |
| POST   | `/api/v1/registrations/mfa/setup`                      | Set up registration MFA              | `postRegistrationsMfaSetup`                     |
| POST   | `/api/v1/registrations/mfa/verify`                     | Verify registration MFA              | `postRegistrationsMfaVerify`                    |
| POST   | `/api/v1/registrations/organization-code-availability` | Check organization code availability | `postRegistrationsOrganizationCodeAvailability` |
| POST   | `/api/v1/registrations/organization-name-availability` | Check organization name availability | `postRegistrationsOrganizationNameAvailability` |
| PUT    | `/api/v1/registrations/progress`                       | Save registration progress           | `putRegistrationsProgress`                      |
| POST   | `/api/v1/registrations/resend-otp`                     | Resend registration OTP              | `postRegistrationsResendOtp`                    |
| POST   | `/api/v1/registrations/send-email-otp`                 | Send registration email OTP          | `postRegistrationsSendEmailOtp`                 |
| POST   | `/api/v1/registrations/send-mobile-otp`                | Send registration mobile OTP         | `postRegistrationsSendMobileOtp`                |
| POST   | `/api/v1/registrations/sessions`                       | Start registration session           | `postRegistrationsSessions`                     |
| GET    | `/api/v1/registrations/sessions/{id}`                  | Get registration session             | `getRegistrationsSessionsById`                  |
| GET    | `/api/v1/registrations/status`                         | Get registration availability        | `getRegistrationsStatus`                        |
| POST   | `/api/v1/registrations/verify-email`                   | Verify registration email            | `postRegistrationsVerifyEmail`                  |
| POST   | `/api/v1/registrations/verify-mobile`                  | Verify registration mobile           | `postRegistrationsVerifyMobile`                 |

## Settings

| Method | URL                          | Name                    | Operation ID           |
| ------ | ---------------------------- | ----------------------- | ---------------------- |
| GET    | `/api/v1/settings`           | Get settings            | `getSettings`          |
| GET    | `/api/v1/settings/{section}` | Get settings section    | `getSettingsBySection` |
| PUT    | `/api/v1/settings/{section}` | Update settings section | `putSettingsBySection` |

## Storage

| Method | URL                      | Name        | Operation ID        |
| ------ | ------------------------ | ----------- | ------------------- |
| POST   | `/api/v1/storage/upload` | Upload file | `postStorageUpload` |

## System

| Method | URL       | Name                    | Operation ID          |
| ------ | --------- | ----------------------- | --------------------- |
| GET    | `/`       | Open API documentation  | `getApiDocumentation` |
| GET    | `/health` | Check service health    | `getHealth`           |
| GET    | `/info`   | Get service information | `getInfo`             |

## Technologies

| Method | URL                                                        | Name                                  | Operation ID                                          |
| ------ | ---------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| GET    | `/api/v1/projects/{projectId}/technologies`                | Get technologies for project          | `getProjectsByProjectIdTechnologies`                  |
| POST   | `/api/v1/projects/{projectId}/technologies`                | Add technology to project             | `postProjectsByProjectIdTechnologies`                 |
| PUT    | `/api/v1/projects/{projectId}/technologies`                | Bulk replace technologies for project | `putProjectsByProjectIdTechnologies`                  |
| DELETE | `/api/v1/projects/{projectId}/technologies/{technologyId}` | Remove technology from project        | `deleteProjectsByProjectIdTechnologiesByTechnologyId` |
| GET    | `/api/v1/technologies`                                     | Get all technologies                  | `getTechnologies`                                     |
| POST   | `/api/v1/technologies`                                     | Create technology                     | `postTechnologies`                                    |

## Timesheets

| Method | URL                                         | Name                          | Operation ID                          |
| ------ | ------------------------------------------- | ----------------------------- | ------------------------------------- |
| GET    | `/api/v1/timesheets`                        | Get or list timesheets        | `getTimesheets`                       |
| GET    | `/api/v1/timesheets/{id}`                   | Get timesheet by ID           | `getTimesheetsById`                   |
| POST   | `/api/v1/timesheets/{id}/approve`           | Approve timesheet             | `postTimesheetsByIdApprove`           |
| PATCH  | `/api/v1/timesheets/{id}/entries/{entryId}` | Update timesheet entry        | `patchTimesheetsByIdEntriesByEntryId` |
| POST   | `/api/v1/timesheets/{id}/entries/bulk`      | Bulk upsert timesheet entries | `postTimesheetsByIdEntriesBulk`       |
| GET    | `/api/v1/timesheets/{id}/export`            | Export timesheet              | `getTimesheetsByIdExport`             |
| POST   | `/api/v1/timesheets/{id}/reject`            | Reject timesheet              | `postTimesheetsByIdReject`            |
| POST   | `/api/v1/timesheets/{id}/submit`            | Submit timesheet              | `postTimesheetsByIdSubmit`            |
| GET    | `/api/v1/timesheets/summary`                | Get timesheet year summary    | `getTimesheetsSummary`                |

## Verifications

| Method | URL                            | Name                        | Operation ID              |
| ------ | ------------------------------ | --------------------------- | ------------------------- |
| POST   | `/api/v1/verifications/send`   | Send verification challenge | `postVerificationsSend`   |
| POST   | `/api/v1/verifications/verify` | Verify challenge            | `postVerificationsVerify` |
