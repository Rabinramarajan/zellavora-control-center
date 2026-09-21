# API operation catalog

Canonical URLs and operation names. Historical aliases are listed in [API_NAMING.md](API_NAMING.md). The live contract is available at `/swagger/swagger.json`.

## accessControl

| Method | URL                                                | Name                               | Operation ID                                 |
| ------ | -------------------------------------------------- | ---------------------------------- | -------------------------------------------- |
| GET    | `/api/v1/rbac/audit-logs`                          | searchTheRbacAuditLog | `getRbacAuditLogs`                           |
| POST   | `/api/v1/rbac/check`                               | checkMultiplePermissions | `postRbacCheck`                              |
| GET    | `/api/v1/rbac/me/policy`                           | getCurrentUserPermissionPolicy | `getRbacMePolicy`                            |
| GET    | `/api/v1/rbac/permissions`                         | listAllPermissions | `getRbacPermissions`                         |
| GET    | `/api/v1/rbac/permissions/groups`                  | listPermissionGroups | `getRbacPermissionsGroups`                   |
| GET    | `/api/v1/rbac/roles`                               | listAllRolesInTheTenant | `getRbacRoles`                               |
| POST   | `/api/v1/rbac/roles`                               | createRole | `postRbacRoles`                              |
| DELETE | `/api/v1/rbac/roles/{id}`                          | deleteRole | `deleteRbacRolesById`                        |
| GET    | `/api/v1/rbac/roles/{id}`                          | getRoleDetail | `getRbacRolesById`                           |
| PATCH  | `/api/v1/rbac/roles/{id}`                          | updateRole | `patchRbacRolesById`                         |
| POST   | `/api/v1/rbac/roles/{id}/clone`                    | cloneRole | `postRbacRolesByIdClone`                     |
| PUT    | `/api/v1/rbac/roles/{id}/inheritance`              | setRoleInheritance | `putRbacRolesByIdInheritance`                |
| PUT    | `/api/v1/rbac/roles/{id}/permissions`              | replaceRolePermissions | `putRbacRolesByIdPermissions`                |
| GET    | `/api/v1/rbac/users/{userId}/roles`                | listRoleAssignmentsForUser | `getRbacUsersByUserIdRoles`                  |
| POST   | `/api/v1/rbac/users/{userId}/roles`                | assignRoleToUser | `postRbacUsersByUserIdRoles`                 |
| DELETE | `/api/v1/rbac/users/{userId}/roles/{assignmentId}` | revokeRoleAssignmentFromUser | `deleteRbacUsersByUserIdRolesByAssignmentId` |

## administrationAuditLogs

| Method | URL                                | Name                          | Operation ID                |
| ------ | ---------------------------------- | ----------------------------- | --------------------------- |
| POST   | `/api/v1/admin/audit-logs/details` | loadAuditLogDetails | `postAdminAuditLogsDetails` |
| GET    | `/api/v1/admin/audit-logs/search`  | getAuditLogSearchTemplate | `getAdminAuditLogsSearch`   |
| POST   | `/api/v1/admin/audit-logs/search`  | searchAuditLogs | `postAdminAuditLogsSearch`  |

## administrationBranches

| Method | URL                               | Name                        | Operation ID               |
| ------ | --------------------------------- | --------------------------- | -------------------------- |
| POST   | `/api/v1/admin/branches/delete`   | deleteBranch | `postAdminBranchesDelete`  |
| POST   | `/api/v1/admin/branches/details`  | loadBranchDetails | `postAdminBranchesDetails` |
| POST   | `/api/v1/admin/branches/save`     | saveBranchDetails | `postAdminBranchesSave`    |
| GET    | `/api/v1/admin/branches/search`   | getBranchSearchTemplate | `getAdminBranchesSearch`   |
| POST   | `/api/v1/admin/branches/search`   | searchBranch | `postAdminBranchesSearch`  |
| GET    | `/api/v1/admin/branches/template` | getTemplateForNewBranch | `getAdminBranchesTemplate` |

## administrationConfiguration

| Method | URL                                    | Name                              | Operation ID                     |
| ------ | -------------------------------------- | --------------------------------- | -------------------------------- |
| POST   | `/api/v1/admin/configurations/delete`  | deleteConfiguration | `postAdminConfigurationsDelete`  |
| POST   | `/api/v1/admin/configurations/details` | loadConfigurationDetails | `postAdminConfigurationsDetails` |
| POST   | `/api/v1/admin/configurations/list`    | loadAllConfigurations | `postAdminConfigurationsList`    |
| POST   | `/api/v1/admin/configurations/save`    | saveConfigurationDetails | `postAdminConfigurationsSave`    |
| GET    | `/api/v1/admin/configurations/search`  | getConfigurationSearchTemplate | `getAdminConfigurationsSearch`   |
| POST   | `/api/v1/admin/configurations/search`  | searchConfigurations | `postAdminConfigurationsSearch`  |
| GET    | `/api/v1/admin/regions/metadata`       | getRegionalInitialMetadata | `getAdminRegionsMetadata`        |

## administrationGroups

| Method | URL                            | Name                      | Operation ID             |
| ------ | ------------------------------ | ------------------------- | ------------------------ |
| POST   | `/api/v1/admin/groups/delete`  | deleteGroup | `postAdminGroupsDelete`  |
| POST   | `/api/v1/admin/groups/details` | loadGroupDetails | `postAdminGroupsDetails` |
| POST   | `/api/v1/admin/groups/save`    | saveGroupDetails | `postAdminGroupsSave`    |
| GET    | `/api/v1/admin/groups/search`  | getGroupSearchTemplate | `getAdminGroupsSearch`   |
| POST   | `/api/v1/admin/groups/search`  | searchGroups | `postAdminGroupsSearch`  |

## administrationMessages

| Method | URL                           | Name         | Operation ID            |
| ------ | ----------------------------- | ------------ | ----------------------- |
| POST   | `/api/v1/admin/emails/send`   | sendEmail | `postAdminEmailsSend`   |
| POST   | `/api/v1/admin/messages/send` | sendMessage | `postAdminMessagesSend` |

## administrationResources

| Method | URL                                 | Name                          | Operation ID                 |
| ------ | ----------------------------------- | ----------------------------- | ---------------------------- |
| POST   | `/api/v1/admin/resources/bulk-save` | saveListOfResources | `postAdminResourcesBulkSave` |
| POST   | `/api/v1/admin/resources/delete`    | deleteResource | `postAdminResourcesDelete`   |
| POST   | `/api/v1/admin/resources/details`   | loadResourceDetailsById | `postAdminResourcesDetails`  |
| GET    | `/api/v1/admin/resources/metadata`  | initializeResourceMetadata | `getAdminResourcesMetadata`  |
| POST   | `/api/v1/admin/resources/save`      | saveResourceDetails | `postAdminResourcesSave`     |
| GET    | `/api/v1/admin/resources/search`    | getResourceSearchTemplate | `getAdminResourcesSearch`    |
| POST   | `/api/v1/admin/resources/search`    | searchResources | `postAdminResourcesSearch`   |
| GET    | `/api/v1/admin/resources/template`  | getTemplateForNewResource | `getAdminResourcesTemplate`  |

## administrationRoles

| Method | URL                                             | Name                        | Operation ID                            |
| ------ | ----------------------------------------------- | --------------------------- | --------------------------------------- |
| POST   | `/api/v1/admin/roles/delete`                    | deleteRole | `postAdminRolesDelete`                  |
| POST   | `/api/v1/admin/roles/details`                   | loadRoleDetailsById | `postAdminRolesDetails`                 |
| GET    | `/api/v1/admin/roles/metadata`                  | initializeRoleMetadata | `getAdminRolesMetadata`                 |
| POST   | `/api/v1/admin/roles/resource-mappings/details` | loadRoleResourceMappings | `postAdminRolesResourceMappingsDetails` |
| POST   | `/api/v1/admin/roles/resource-mappings/save`    | saveRoleResourceMappings | `postAdminRolesResourceMappingsSave`    |
| POST   | `/api/v1/admin/roles/save`                      | saveRoleDetails | `postAdminRolesSave`                    |
| GET    | `/api/v1/admin/roles/search`                    | getRoleSearchTemplate | `getAdminRolesSearch`                   |
| POST   | `/api/v1/admin/roles/search`                    | searchRoles | `postAdminRolesSearch`                  |
| GET    | `/api/v1/admin/roles/template`                  | getTemplateForNewRole | `getAdminRolesTemplate`                 |

## administrationUsers

| Method | URL                                       | Name                           | Operation ID                      |
| ------ | ----------------------------------------- | ------------------------------ | --------------------------------- |
| GET    | `/api/v1/admin/users/assignable-roles`    | getRolesAssignableToUser | `getAdminUsersAssignableRoles`    |
| POST   | `/api/v1/admin/users/branch-options`      | loadBranchDropdownDetails | `postAdminUsersBranchOptions`     |
| POST   | `/api/v1/admin/users/details`             | loadUserDetailsBySerialId | `postAdminUsersDetails`           |
| GET    | `/api/v1/admin/users/metadata`            | initializeUserData | `getAdminUsersMetadata`           |
| POST   | `/api/v1/admin/users/save`                | saveUserDetails | `postAdminUsersSave`              |
| GET    | `/api/v1/admin/users/search`              | getUserSearchTemplate | `getAdminUsersSearch`             |
| POST   | `/api/v1/admin/users/search`              | searchUsers | `postAdminUsersSearch`            |
| POST   | `/api/v1/admin/users/team-members/search` | getTeamUsers | `postAdminUsersTeamMembersSearch` |
| GET    | `/api/v1/admin/users/template`            | getTemplateForNewUser | `getAdminUsersTemplate`           |

## auditLogs

| Method | URL                      | Name               | Operation ID       |
| ------ | ------------------------ | ------------------ | ------------------ |
| GET    | `/api/v1/audit-logs`     | listAuditLogs | `getAuditLogs`     |
| POST   | `/api/v1/audit-logs/log` | createAuditEvent | `postAuditLogsLog` |

## authentication

| Method | URL                                 | Name                                                | Operation ID                    |
| ------ | ----------------------------------- | --------------------------------------------------- | ------------------------------- |
| POST   | `/api/v1/auth/change-password`      | changeAccountPassword | `postAuthChangePassword`        |
| GET    | `/api/v1/auth/clients`              | listActiveTenants | `getAuthClients`                |
| POST   | `/api/v1/auth/debug/check-user`     | checkUserAuthenticationConfiguration | `postAuthDebugCheckUser`        |
| GET    | `/api/v1/auth/encryption-key`       | getPayloadEncryptionKey | `getAuthEncryptionKey`          |
| POST   | `/api/v1/auth/forgot-password`      | sendPasswordResetEmail | `postAuthForgotPassword`        |
| POST   | `/api/v1/auth/login`                | signInWithEmailAndPassword | `postAuthLogin`                 |
| POST   | `/api/v1/auth/login/mfa`            | completeMfaChallenge | `postAuthLoginMfa`              |
| POST   | `/api/v1/auth/logout`               | revokeCurrentSession | `postAuthLogout`                |
| POST   | `/api/v1/auth/logout-all`           | revokeAllSessionsForTheCurrentUser | `postAuthLogoutAll`             |
| GET    | `/api/v1/auth/me`                   | getCurrentUserProfileWithPermissionsAndMenu | `getAuthMe`                     |
| POST   | `/api/v1/auth/mfa/confirm`          | confirmTotpEnrollment | `postAuthMfaConfirm`            |
| POST   | `/api/v1/auth/mfa/disable`          | disableMfa | `postAuthMfaDisable`            |
| POST   | `/api/v1/auth/mfa/enroll`           | startTotpEnrollment | `postAuthMfaEnroll`             |
| POST   | `/api/v1/auth/mfa/recovery-codes`   | regenerateMfaRecoveryCodes | `postAuthMfaRecoveryCodes`      |
| GET    | `/api/v1/auth/oauth/{provider}`     | startOauthSignIn | `getAuthOauthByProvider`        |
| GET    | `/api/v1/auth/oauth/callback`       | handleOauthCallback | `getAuthOauthCallback`          |
| POST   | `/api/v1/auth/refresh`              | refreshAccessAndRefreshTokens | `postAuthRefresh`               |
| POST   | `/api/v1/auth/resend-otp`           | resendEmailVerificationOtp | `postAuthResendOtp`             |
| POST   | `/api/v1/auth/reset-password`       | resetAccountPassword | `postAuthResetPassword`         |
| POST   | `/api/v1/auth/send-verification`    | sendOrResendEmailVerificationCode | `postAuthSendVerification`      |
| DELETE | `/api/v1/auth/sessions`             | revokeAllSessionsExceptTheCurrentOne | `deleteAuthSessions`            |
| GET    | `/api/v1/auth/sessions`             | listAllActiveSessionsForTheAuthenticatedUser | `getAuthSessions`               |
| DELETE | `/api/v1/auth/sessions/{sessionId}` | revokeSession | `deleteAuthSessionsBySessionId` |
| POST   | `/api/v1/auth/switch-tenant`        | switchActiveTenant | `postAuthSwitchTenant`          |
| GET    | `/api/v1/auth/tenants`              | listTenantsTheCurrentUserBelongsTo | `getAuthTenants`                |
| POST   | `/api/v1/auth/validate-client`      | validateTenantCode | `postAuthValidateClient`        |
| POST   | `/api/v1/auth/verify-email`         | verifyEmailWithTokenOrOtpCode | `postAuthVerifyEmail`           |

## branches

| Method | URL                     | Name             | Operation ID      |
| ------ | ----------------------- | ---------------- | ----------------- |
| GET    | `/api/v1/branches`      | listBranches | `getBranches`     |
| POST   | `/api/v1/branches`      | createBranch | `postBranches`    |
| GET    | `/api/v1/branches/{id}` | getBranchById | `getBranchesById` |
| PUT    | `/api/v1/branches/{id}` | updateBranch | `putBranchesById` |

## dailySheets

| Method | URL                                 | Name                  | Operation ID                 |
| ------ | ----------------------------------- | --------------------- | ---------------------------- |
| GET    | `/api/v1/daily-sheets`              | listDailySheets | `getDailySheets`             |
| POST   | `/api/v1/daily-sheets`              | createDailySheet | `postDailySheets`            |
| DELETE | `/api/v1/daily-sheets/{id}`         | deleteDailySheet | `deleteDailySheetsById`      |
| GET    | `/api/v1/daily-sheets/{id}`         | getDailySheetById | `getDailySheetsById`         |
| PUT    | `/api/v1/daily-sheets/{id}`         | updateDailySheet | `putDailySheetsById`         |
| POST   | `/api/v1/daily-sheets/{id}/approve` | approveDailySheet | `postDailySheetsByIdApprove` |
| POST   | `/api/v1/daily-sheets/{id}/submit`  | submitDailySheet | `postDailySheetsByIdSubmit`  |

## dashboard

| Method | URL                          | Name                   | Operation ID           |
| ------ | ---------------------------- | ---------------------- | ---------------------- |
| GET    | `/api/v1/dashboard/activity` | getDashboardActivity | `getDashboardActivity` |
| GET    | `/api/v1/dashboard/overview` | getDashboardOverview | `getDashboardOverview` |

## email

| Method | URL                                 | Name                                | Operation ID                 |
| ------ | ----------------------------------- | ----------------------------------- | ---------------------------- |
| GET    | `/api/v1/email/health`              | checkEmailServiceHealth | `getEmailHealth`             |
| POST   | `/api/v1/email/send-2fa-code`       | sendTwoFactorAuthenticationCode | `postEmailSend2faCode`       |
| POST   | `/api/v1/email/send-invitation`     | sendUserInvitationEmail | `postEmailSendInvitation`    |
| POST   | `/api/v1/email/send-otp`            | sendOtpEmail | `postEmailSendOtp`           |
| POST   | `/api/v1/email/send-password-reset` | sendPasswordResetEmail | `postEmailSendPasswordReset` |
| POST   | `/api/v1/email/send-security-alert` | sendSecurityAlertEmail | `postEmailSendSecurityAlert` |
| POST   | `/api/v1/email/send-verification`   | sendEmailVerification | `postEmailSendVerification`  |
| POST   | `/api/v1/email/send-welcome`        | sendWelcomeEmail | `postEmailSendWelcome`       |

## iamGroups

| Method | URL                                        | Name                | Operation ID                         |
| ------ | ------------------------------------------ | ------------------- | ------------------------------------ |
| GET    | `/api/v1/iam/groups`                       | listGroups | `getIamGroups`                       |
| POST   | `/api/v1/iam/groups`                       | createGroup | `postIamGroups`                      |
| DELETE | `/api/v1/iam/groups/{id}`                  | deleteGroup | `deleteIamGroupsById`                |
| GET    | `/api/v1/iam/groups/{id}`                  | getGroupById | `getIamGroupsById`                   |
| PATCH  | `/api/v1/iam/groups/{id}`                  | updateGroup | `patchIamGroupsById`                 |
| POST   | `/api/v1/iam/groups/{id}/members`          | addGroupMembers | `postIamGroupsByIdMembers`           |
| DELETE | `/api/v1/iam/groups/{id}/members/{userId}` | removeGroupMember | `deleteIamGroupsByIdMembersByUserId` |
| PUT    | `/api/v1/iam/groups/{id}/roles`            | setGroupRoles | `putIamGroupsByIdRoles`              |
| GET    | `/api/v1/iam/groups/tree`                  | getGroupHierarchy | `getIamGroupsTree`                   |

## iamResources

| Method | URL                                             | Name                   | Operation ID                              |
| ------ | ----------------------------------------------- | ---------------------- | ----------------------------------------- |
| GET    | `/api/v1/iam/resources`                         | listResources | `getIamResources`                         |
| POST   | `/api/v1/iam/resources`                         | createResource | `postIamResources`                        |
| DELETE | `/api/v1/iam/resources/{id}`                    | deleteResource | `deleteIamResourcesById`                  |
| GET    | `/api/v1/iam/resources/{id}`                    | getResourceById | `getIamResourcesById`                     |
| PATCH  | `/api/v1/iam/resources/{id}`                    | updateResource | `patchIamResourcesById`                   |
| POST   | `/api/v1/iam/resources/{id}/actions`            | addResourceAction | `postIamResourcesByIdActions`             |
| DELETE | `/api/v1/iam/resources/{id}/actions/{actionId}` | removeResourceAction | `deleteIamResourcesByIdActionsByActionId` |
| GET    | `/api/v1/iam/resources/key/{key}`               | getResourceByKey | `getIamResourcesKeyByKey`                 |
| GET    | `/api/v1/iam/resources/tree`                    | getResourceHierarchy | `getIamResourcesTree`                     |

## iamRoles

| Method | URL                                  | Name                  | Operation ID                 |
| ------ | ------------------------------------ | --------------------- | ---------------------------- |
| GET    | `/api/v1/iam/roles`                  | listRoles | `getIamRoles`                |
| POST   | `/api/v1/iam/roles`                  | createRole | `postIamRoles`               |
| DELETE | `/api/v1/iam/roles/{id}`             | deleteRole | `deleteIamRolesById`         |
| GET    | `/api/v1/iam/roles/{id}`             | getRoleById | `getIamRolesById`            |
| PATCH  | `/api/v1/iam/roles/{id}`             | updateRole | `patchIamRolesById`          |
| POST   | `/api/v1/iam/roles/{id}/copy`        | copyRole | `postIamRolesByIdCopy`       |
| GET    | `/api/v1/iam/roles/{id}/permissions` | listRolePermissions | `getIamRolesByIdPermissions` |
| PUT    | `/api/v1/iam/roles/{id}/permissions` | setRolePermissions | `putIamRolesByIdPermissions` |
| GET    | `/api/v1/iam/roles/all`              | listAllRoles | `getIamRolesAll`             |

## iamUsers

| Method | URL                             | Name            | Operation ID             |
| ------ | ------------------------------- | --------------- | ------------------------ |
| GET    | `/api/v1/iam/users`             | listUsers | `getIamUsers`            |
| POST   | `/api/v1/iam/users`             | createUser | `postIamUsers`           |
| DELETE | `/api/v1/iam/users/{id}`        | deleteUser | `deleteIamUsersById`     |
| GET    | `/api/v1/iam/users/{id}`        | getUserById | `getIamUsersById`        |
| PATCH  | `/api/v1/iam/users/{id}`        | updateUser | `patchIamUsersById`      |
| PUT    | `/api/v1/iam/users/{id}/groups` | setUserGroups | `putIamUsersByIdGroups`  |
| POST   | `/api/v1/iam/users/{id}/lock`   | lockUser | `postIamUsersByIdLock`   |
| PUT    | `/api/v1/iam/users/{id}/roles`  | setUserRoles | `putIamUsersByIdRoles`   |
| PUT    | `/api/v1/iam/users/{id}/status` | setUserStatus | `putIamUsersByIdStatus`  |
| POST   | `/api/v1/iam/users/{id}/unlock` | unlockUser | `postIamUsersByIdUnlock` |

## identityAuthentication

| Method | URL                               | Name                   | Operation ID               |
| ------ | --------------------------------- | ---------------------- | -------------------------- |
| POST   | `/api/v1/identity/auth/login`     | signIn | `postIdentityAuthLogin`    |
| POST   | `/api/v1/identity/auth/login/mfa` | completeMfaChallenge | `postIdentityAuthLoginMfa` |
| POST   | `/api/v1/identity/auth/refresh`   | refreshTokens | `postIdentityAuthRefresh`  |

## invitations

| Method | URL                            | Name                | Operation ID              |
| ------ | ------------------------------ | ------------------- | ------------------------- |
| POST   | `/api/v1/invitations/generate` | generateInvitation | `postInvitationsGenerate` |
| POST   | `/api/v1/invitations/verify`   | verifyInvitation | `postInvitationsVerify`   |

## lookups

| Method | URL                      | Name                      | Operation ID       |
| ------ | ------------------------ | ------------------------- | ------------------ |
| GET    | `/api/v1/lookups`        | listLookupData | `getLookups`       |
| GET    | `/api/v1/lookups/{type}` | listLookupDataByType | `getLookupsByType` |
| GET    | `/api/v1/lookups/types`  | listLookupDataByTypes | `getLookupsTypes`  |

## monthlySheets

| Method | URL                                     | Name                       | Operation ID                    |
| ------ | --------------------------------------- | -------------------------- | ------------------------------- |
| GET    | `/api/v1/monthly-sheets`                | listMonthlySheets | `getMonthlySheets`              |
| POST   | `/api/v1/monthly-sheets`                | createMonthlySheet | `postMonthlySheets`             |
| DELETE | `/api/v1/monthly-sheets/{id}`           | deleteMonthlySheet | `deleteMonthlySheetsById`       |
| GET    | `/api/v1/monthly-sheets/{id}`           | getMonthlySheetById | `getMonthlySheetsById`          |
| PUT    | `/api/v1/monthly-sheets/{id}`           | updateMonthlySheet | `putMonthlySheetsById`          |
| POST   | `/api/v1/monthly-sheets/{id}/approve`   | approveMonthlySheet | `postMonthlySheetsByIdApprove`  |
| POST   | `/api/v1/monthly-sheets/{id}/mark-paid` | markMonthlySheetAsPaid | `postMonthlySheetsByIdMarkPaid` |
| POST   | `/api/v1/monthly-sheets/{id}/submit`    | submitMonthlySheet | `postMonthlySheetsByIdSubmit`   |

## notifications

| Method | URL                          | Name               | Operation ID            |
| ------ | ---------------------------- | ------------------ | ----------------------- |
| GET    | `/api/v1/notifications`      | listNotifications | `getNotifications`      |
| POST   | `/api/v1/notifications/send` | sendNotification | `postNotificationsSend` |

## organizationSettings

| Method | URL                                   | Name                            | Operation ID                   |
| ------ | ------------------------------------- | ------------------------------- | ------------------------------ |
| GET    | `/api/v1/organization-settings`       | listOrganizationSettings | `getOrganizationSettings`      |
| POST   | `/api/v1/organization-settings`       | saveOrganizationSetting | `postOrganizationSettings`     |
| GET    | `/api/v1/organization-settings/{key}` | getOrganizationSettingByKey | `getOrganizationSettingsByKey` |

## organizations

| Method | URL                          | Name                   | Operation ID           |
| ------ | ---------------------------- | ---------------------- | ---------------------- |
| POST   | `/api/v1/organizations`      | createOrganization | `postOrganizations`    |
| GET    | `/api/v1/organizations/{id}` | getOrganizationById | `getOrganizationsById` |
| PUT    | `/api/v1/organizations/{id}` | updateOrganization | `putOrganizationsById` |

## permissions

| Method | URL                          | Name              | Operation ID            |
| ------ | ---------------------------- | ----------------- | ----------------------- |
| GET    | `/api/v1/permissions`        | listPermissions | `getPermissions`        |
| POST   | `/api/v1/permissions`        | createPermission | `postPermissions`       |
| POST   | `/api/v1/permissions/assign` | assignPermission | `postPermissionsAssign` |

## portfolio

| Method | URL                         | Name                             | Operation ID             |
| ------ | --------------------------- | -------------------------------- | ------------------------ |
| GET    | `/api/v1/education`         | listEducationEntriesForUser | `getEducation`           |
| POST   | `/api/v1/education`         | createEducationEntry | `postEducation`          |
| DELETE | `/api/v1/education/{id}`    | deleteEducationEntry | `deleteEducationById`    |
| PUT    | `/api/v1/education/{id}`    | updateEducationEntry | `putEducationById`       |
| GET    | `/api/v1/experience`        | listExperienceEntriesForUser | `getExperience`          |
| POST   | `/api/v1/experience`        | createExperienceEntry | `postExperience`         |
| DELETE | `/api/v1/experience/{id}`   | deleteExperienceEntry | `deleteExperienceById`   |
| PUT    | `/api/v1/experience/{id}`   | updateExperienceEntry | `putExperienceById`      |
| GET    | `/api/v1/profile`           | getUserProfile | `getProfile`             |
| PUT    | `/api/v1/profile`           | updateCurrentUserProfile | `putProfile`             |
| GET    | `/api/v1/services`          | listServicesForUser | `getServices`            |
| POST   | `/api/v1/services`          | createService | `postServices`           |
| DELETE | `/api/v1/services/{id}`     | deleteService | `deleteServicesById`     |
| PUT    | `/api/v1/services/{id}`     | updateService | `putServicesById`        |
| GET    | `/api/v1/skills`            | listSkillsForUser | `getSkills`              |
| POST   | `/api/v1/skills`            | createSkill | `postSkills`             |
| DELETE | `/api/v1/skills/{id}`       | deleteSkill | `deleteSkillsById`       |
| PUT    | `/api/v1/skills/{id}`       | updateSkill | `putSkillsById`          |
| GET    | `/api/v1/testimonials`      | listTestimonialsForUser | `getTestimonials`        |
| POST   | `/api/v1/testimonials`      | createTestimonial | `postTestimonials`       |
| DELETE | `/api/v1/testimonials/{id}` | deleteTestimonial | `deleteTestimonialsById` |
| PUT    | `/api/v1/testimonials/{id}` | updateTestimonial | `putTestimonialsById`    |

## projectGallery

| Method | URL                                              | Name                               | Operation ID                                |
| ------ | ------------------------------------------------ | ---------------------------------- | ------------------------------------------- |
| GET    | `/api/v1/projects/{projectId}/gallery`           | getAllGalleryImagesForProject | `getProjectsByProjectIdGallery`             |
| POST   | `/api/v1/projects/{projectId}/gallery`           | uploadGalleryImageToProject | `postProjectsByProjectIdGallery`            |
| DELETE | `/api/v1/projects/{projectId}/gallery/{imageId}` | deleteGalleryItem | `deleteProjectsByProjectIdGalleryByImageId` |
| PUT    | `/api/v1/projects/{projectId}/gallery/{imageId}` | updateGalleryItem | `putProjectsByProjectIdGalleryByImageId`    |

## projects

| Method | URL                             | Name                | Operation ID              |
| ------ | ------------------------------- | ------------------- | ------------------------- |
| GET    | `/api/v1/projects`              | listProjects | `getProjects`             |
| POST   | `/api/v1/projects`              | createProject | `postProjects`            |
| DELETE | `/api/v1/projects/{id}`         | deleteProject | `deleteProjectsById`      |
| GET    | `/api/v1/projects/{id}`         | getProjectById | `getProjectsById`         |
| PUT    | `/api/v1/projects/{id}`         | updateProject | `putProjectsById`         |
| POST   | `/api/v1/projects/{id}/archive` | archiveProject | `postProjectsByIdArchive` |
| POST   | `/api/v1/projects/{id}/publish` | publishProject | `postProjectsByIdPublish` |
| GET    | `/api/v1/projects/slug/{slug}`  | getProjectBySlug | `getProjectsSlugBySlug`   |

## registration

| Method | URL                                                    | Name                                 | Operation ID                                    |
| ------ | ------------------------------------------------------ | ------------------------------------ | ----------------------------------------------- |
| GET    | `/api/v1/auth/registrations/mfa-setup`                 | generateMfaSetup | `getAuthRegistrationsMfaSetup`                  |
| POST   | `/api/v1/auth/registrations/send-email-otp`            | sendRegistrationEmailOtp | `postAuthRegistrationsSendEmailOtp`             |
| POST   | `/api/v1/auth/registrations/submit`                    | submitRegistration | `postAuthRegistrationsSubmit`                   |
| POST   | `/api/v1/auth/registrations/verify-email-otp`          | verifyRegistrationEmailOtp | `postAuthRegistrationsVerifyEmailOtp`           |
| POST   | `/api/v1/auth/registrations/verify-invitation`         | verifyInvitationCode | `postAuthRegistrationsVerifyInvitation`         |
| POST   | `/api/v1/registrations/complete`                       | completeRegistration | `postRegistrationsComplete`                     |
| POST   | `/api/v1/registrations/email-availability`             | checkEmailAvailability | `postRegistrationsEmailAvailability`            |
| POST   | `/api/v1/registrations/mfa/setup`                      | setUpRegistrationMfa | `postRegistrationsMfaSetup`                     |
| POST   | `/api/v1/registrations/mfa/verify`                     | verifyRegistrationMfa | `postRegistrationsMfaVerify`                    |
| POST   | `/api/v1/registrations/organization-code-availability` | checkOrganizationCodeAvailability | `postRegistrationsOrganizationCodeAvailability` |
| POST   | `/api/v1/registrations/organization-name-availability` | checkOrganizationNameAvailability | `postRegistrationsOrganizationNameAvailability` |
| PUT    | `/api/v1/registrations/progress`                       | saveRegistrationProgress | `putRegistrationsProgress`                      |
| POST   | `/api/v1/registrations/resend-otp`                     | resendRegistrationOtp | `postRegistrationsResendOtp`                    |
| POST   | `/api/v1/registrations/send-email-otp`                 | sendRegistrationEmailOtp | `postRegistrationsSendEmailOtp`                 |
| POST   | `/api/v1/registrations/send-mobile-otp`                | sendRegistrationMobileOtp | `postRegistrationsSendMobileOtp`                |
| POST   | `/api/v1/registrations/sessions`                       | startRegistrationSession | `postRegistrationsSessions`                     |
| GET    | `/api/v1/registrations/sessions/{id}`                  | getRegistrationSession | `getRegistrationsSessionsById`                  |
| GET    | `/api/v1/registrations/status`                         | getRegistrationAvailability | `getRegistrationsStatus`                        |
| POST   | `/api/v1/registrations/verify-email`                   | verifyRegistrationEmail | `postRegistrationsVerifyEmail`                  |
| POST   | `/api/v1/registrations/verify-mobile`                  | verifyRegistrationMobile | `postRegistrationsVerifyMobile`                 |

## settings

| Method | URL                          | Name                    | Operation ID           |
| ------ | ---------------------------- | ----------------------- | ---------------------- |
| GET    | `/api/v1/settings`           | getSettings | `getSettings`          |
| GET    | `/api/v1/settings/{section}` | getSettingsSection | `getSettingsBySection` |
| PUT    | `/api/v1/settings/{section}` | updateSettingsSection | `putSettingsBySection` |

## storage

| Method | URL                      | Name        | Operation ID        |
| ------ | ------------------------ | ----------- | ------------------- |
| POST   | `/api/v1/storage/upload` | uploadFile | `postStorageUpload` |

## system

| Method | URL       | Name                    | Operation ID          |
| ------ | --------- | ----------------------- | --------------------- |
| GET    | `/`       | openApiDocumentation | `getApiDocumentation` |
| GET    | `/health` | checkServiceHealth | `getHealth`           |
| GET    | `/info`   | getServiceInformation | `getInfo`             |

## technologies

| Method | URL                                                        | Name                                  | Operation ID                                          |
| ------ | ---------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| GET    | `/api/v1/projects/{projectId}/technologies`                | getTechnologiesForProject | `getProjectsByProjectIdTechnologies`                  |
| POST   | `/api/v1/projects/{projectId}/technologies`                | addTechnologyToProject | `postProjectsByProjectIdTechnologies`                 |
| PUT    | `/api/v1/projects/{projectId}/technologies`                | bulkReplaceTechnologiesForProject | `putProjectsByProjectIdTechnologies`                  |
| DELETE | `/api/v1/projects/{projectId}/technologies/{technologyId}` | removeTechnologyFromProject | `deleteProjectsByProjectIdTechnologiesByTechnologyId` |
| GET    | `/api/v1/technologies`                                     | getAllTechnologies | `getTechnologies`                                     |
| POST   | `/api/v1/technologies`                                     | createTechnology | `postTechnologies`                                    |

## timesheets

| Method | URL                                         | Name                          | Operation ID                          |
| ------ | ------------------------------------------- | ----------------------------- | ------------------------------------- |
| GET    | `/api/v1/timesheets`                        | getOrListTimesheets | `getTimesheets`                       |
| GET    | `/api/v1/timesheets/{id}`                   | getTimesheetById | `getTimesheetsById`                   |
| POST   | `/api/v1/timesheets/{id}/approve`           | approveTimesheet | `postTimesheetsByIdApprove`           |
| PATCH  | `/api/v1/timesheets/{id}/entries/{entryId}` | updateTimesheetEntry | `patchTimesheetsByIdEntriesByEntryId` |
| POST   | `/api/v1/timesheets/{id}/entries/bulk`      | bulkUpsertTimesheetEntries | `postTimesheetsByIdEntriesBulk`       |
| GET    | `/api/v1/timesheets/{id}/export`            | exportTimesheet | `getTimesheetsByIdExport`             |
| POST   | `/api/v1/timesheets/{id}/reject`            | rejectTimesheet | `postTimesheetsByIdReject`            |
| POST   | `/api/v1/timesheets/{id}/submit`            | submitTimesheet | `postTimesheetsByIdSubmit`            |
| GET    | `/api/v1/timesheets/summary`                | getTimesheetYearSummary | `getTimesheetsSummary`                |

## verifications

| Method | URL                            | Name                        | Operation ID              |
| ------ | ------------------------------ | --------------------------- | ------------------------- |
| POST   | `/api/v1/verifications/send`   | sendVerificationChallenge | `postVerificationsSend`   |
| POST   | `/api/v1/verifications/verify` | verifyChallenge | `postVerificationsVerify` |
