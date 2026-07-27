/**
 * Admin module data models based on Swagger API specification
 */

// ==================== Common Models ====================
export interface ApiResponse<T> {
  data?: T;
  infoMessage?: MessageDetail;
  errorMessage?: MessageDetail[];
  hasError: boolean;
}

export interface MessageDetail {
  msgID: number;
  msgType: 'Info' | 'Warning' | 'Error';
  msgDescription: string;
}

export interface PaginationParams {
  pageSize: number;
  pageNumber: number;
  orderByColumnName?: string;
  ascending: boolean;
}

export interface PaginatedResult<T> {
  searchResult?: T[];
  totalCount: number;
  pageSize: number;
  pageNumber: number;
}

// ==================== User Models ====================
export interface User {
  userSerialId: number;
  userLoginId: string;
  keyword?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fatherName?: string;
  motherName?: string;
  dob?: string;
  emailId: string;
  contactNumber: string;
  alternateNumber?: string;
  genderId: number;
  genderValue: string;
  webSession?: string;
  keyToken?: string;
  beginDate: string;
  endDate: string;
  statusId: number;
  statusValue: string;
  designationId: number;
  designationValue: string;
  locationId: number;
  locationValue: string;
  branchId: number;
  branchValue: string;
  employeeCode: string;
  departmentId: number;
  departmentValue: string;
  teamId: number;
  teamValue: string;
  referenceId?: number;
  genderDescription?: string;
  designationDescription?: string;
  teamDescription?: string;
  branchDescription?: string;
  locationDescription?: string;
  statusDescription?: string;
  departmentDescription?: string;
  modifiedBy?: string;
  updateSeq?: number;
  idoObjState?: string;
  fullname?: string;
  employeeNo?: string;
  maritalStatusId?: number;
  maritalStatusValue?: string;
  spouseName?: string;
  spouseDob?: string;

  // New Login/Auth properties
  userName?: string;
  confirmPassword?: string;
  currentLoginDatetime?: string;
  defaultLandingPage?: string;
  enableTwoFactorAuthentication?: boolean;
  isAccountLocked?: boolean;
  lastLockedDate?: string;
  lastLoginDatetime?: string;
  msg?: string;
  newPassword?: string;
  oldPassword?: string;
  otp?: string;
  passwordResetFlag?: boolean;
  successfulLoginAttempts?: number;
  version?: number;
}

export interface UserSearchCriteria extends PaginationParams {
  istrUserName?: string;
  istrFirstName?: string;
  istrLastName?: string;
  istrMiddleName?: string;
  istrDesignation?: string;
  istrUserStatus?: string;
  idtmbeginDateFrom?: string;
  idtmbeginDateTo?: string;
  idtmendDateFrom?: string;
  idtmendDateTo?: string;
  istrGroupid?: number;
  istrGroupStatus?: string;
  istrLocation?: string;
  istrBranch?: string;
  dob?: string;
  emailId?: string;
  contactNumber?: string;
  employeeCode?: string;
}

export interface UserSearchResult extends PaginatedResult<UserSearchSet> {
  searchResult: UserSearchSet[];
}

export interface UserSearchSet {
  userSerialId: number;
  userLoginId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  beginDateFrom?: string;
  endDateFrom?: string;
  statusDescription: string;
  dob?: string;
  emailId: string;
  contactNumber: string;
  employeeCode: string;
  requestRefNo?: string;
  requestedBy?: string;
  requestedDate?: string;
  employeeName?: string;
}

// ==================== Role Models ====================
export interface Role {
  roleId: number;
  roleName: string;
  statusId: number;
  statusValue: string;
  beginDate: string;
  endDate: string;
  moduleId: number;
  moduleValue: string;
  referenceId?: number;
  modifiedBy?: string;
  updateSeq?: number;
  idoObjState?: string;
  statusDescription?: string;
  moduleDescription?: string;
  ilstRoleResource?: RoleResource[];
  screenId?: number;
  screenValue?: string;
  screenDescription?: string;
}

export interface RoleResource {
  roleResourceId: number;
  roleId: number;
  resourceId: number;
  permissionId: number;
  permissionValue: string;
  referenceId?: number;
  modifiedBy?: string;
  updateSeq?: number;
  idoObjState?: string;
}

export interface RoleSearchCriteria extends PaginationParams {
  roleId?: string;
  roleName?: string;
  fromBeginDate?: string;
  toBeginDate?: string;
  fromEndDate?: string;
  toEndDate?: string;
  roleStatusId?: string;
  roleStatusValue?: string;
  roleModuleValue?: string;
  screenValue?: string;
}

export interface RoleSearchResult extends PaginatedResult<RoleSearchSet> {
  searchResult: RoleSearchSet[];
}

export interface RoleSearchSet {
  roleId: number;
  roleName: string;
  moduleDescription: string;
  beginDate: string;
  endDate: string;
  statusDescription: string;
  screenDescription?: string;
}

// ==================== Resource Models ====================
export interface Resource {
  resourceId: number;
  viewNameId: number;
  viewNameValue: string;
  resourceName: string;
  resourceTypeId: number;
  resourceTypeValue: string;
  resourceDescription?: string;
  referenceId?: number;
  viewNameDescription?: string;
  resourceTypeDescription?: string;
  modifiedBy?: string;
  updateSeq?: number;
  idoObjState?: string;
  moduleValue?: string;
}

export interface ResourceSearchCriteria extends PaginationParams {
  resourceId?: number;
  viewNameId?: number;
  viewNameValue?: string;
  resourceName?: string;
  resourceTypeId?: number;
  resourceTypeValue?: string;
  resourceDescription?: string;
}

export interface ResourceSearchResult extends PaginatedResult<ResourceSearchSet> {
  searchResult: ResourceSearchSet[];
}

export interface ResourceSearchSet {
  viewNameDescription: string;
  resourceName: string;
  resourceTypeDescription: string;
  resourceDescription?: string;
  resourceId: number;
}

// ==================== Branch Models ====================
export interface Branch {
  admBranchId: number;
  actCompanyId: number;
  admLocationId: number;
  admRegionId: number;
  branchName: string;
  effectiveDate: string;
  statusId: number;
  statusValue: string;
  branchCode: string;
  modifiedBy?: string;
  updateSeq?: number;
  idoObjState?: string;
}

export interface BranchSearchCriteria extends PaginationParams {
  location?: number;
  branch?: string;
  statusValue?: string;
  fromDate?: string;
  toDate?: string;
  admRegionId?: number;
  actCompanyId?: number;
}

export interface BranchSearchResult extends PaginatedResult<BranchSearchResultSet> {
  searchResultSet: BranchSearchResultSet[];
}

export interface BranchSearchResultSet {
  admBranchId: string;
  branchName: string;
  effectiveDate: string;
  statusDescription: string;
}

// ==================== AuditLog Models ====================
export interface AuditLog {
  auditLogId: number;
  tableName: string;
  primaryKey: number;
  primaryKey2?: string;
  primaryKey3?: string;
  changeModeId: number;
  changeModeValue: string;
  machineIpAddress: string;
  referenceId?: number;
  changeModeDescription?: string;
  lstAuditLogDetail?: AuditLogDetail[];
  modifiedBy?: string;
  updateSeq?: number;
  idoObjState?: string;
}

export interface AuditLogDetail {
  auditLogDetailId: number;
  auditLogId: number;
  columnName: string;
  oldValue: string;
  newValue: string;
  referenceId?: number;
  modifiedBy?: string;
  updateSeq?: number;
  idoObjState?: string;
  changedBy: string;
  changedDate: string;
}

export interface AuditLogSearchCriteria extends PaginationParams {
  auditLogId?: number;
  tableName?: string;
  primaryKey?: string;
  changeModeValue?: string;
  changedBy?: string;
  changedFromDate?: string;
  changedToDate?: string;
}

export interface AuditLogSearchResult extends PaginatedResult<AuditLogSearchSet> {
  plstAuditLogDetail: AuditLogSearchSet[];
}

export interface AuditLogSearchSet {
  tableName: string;
  primaryKey: string;
  changedMode: string;
  logCount: string;
  changedBy: string;
  auditLogId: number;
  changedDate: string;
}

// ==================== Config Models ====================
export interface Config {
  configSerialId: number;
  configId: number;
  configValue: string;
  configDescription: string;
  modifiedBy?: string;
  updateSeq?: number;
  idoObjState?: string;
  configValueList?: ConfigValue[];
}

export interface ConfigValue {
  configId: number;
  configConstant: string;
  configConstDescription?: string;
  configValueSerialId: number;
  referenceId?: number;
  modifiedBy?: string;
  updateSeq?: number;
  idoObjState?: string;
  configMetaDataList?: ConfigMetaData[];
  metaDataValue?: string;
}

export interface ConfigMetaData {
  configMetaDataId: number;
  metaDataName: string;
  metaDataType: string;
  metaDataValue: string;
  configValueSerialId: number;
  referenceId?: number;
  modifiedBy?: string;
  updateSeq?: number;
  idoObjState?: string;
  metaDataDescription?: string;
}

export interface ConfigSearchCriteria extends PaginationParams {
  configSerialId?: string;
  configId?: string;
  configValue?: string;
  configDescription?: string;
  moduleValue?: string;
  configIdFrom?: string;
  configIdTo?: string;
}

export interface ConfigSearchResult extends PaginatedResult<ConfigSearchSet> {
  searchResult: ConfigSearchSet[];
}

export interface ConfigSearchSet {
  configSerialId: number;
  configId: number;
  configValue: string;
  configDescription: string;
}

// ==================== Group Models ====================
export interface Group {
  groupId: number;
  groupName: string;
  beginDate: string;
  endDate: string;
  statusId: number;
  statusValue: string;
  referenceId?: number;
  statusDescription?: string;
  modifiedBy?: string;
  updateSeq?: number;
  idoObjState?: string;
  catetoryId?: number;
  categoryValue?: string;
  currentGroupRoleId?: number;
}

export interface GroupSearchCriteria extends PaginationParams {
  istrgroupId?: number;
  istrgroupName?: string;
  istrgroupBeginDateFrom?: string;
  istrgroupBeginDateTo?: string;
  istrgroupEndDateFrom?: string;
  istrgroupEndDateTo?: string;
  istrgroupStatusid?: number;
  istrgroupStatusvalue?: string;
  istrRoleId?: number;
  moduleValue?: string;
}

export interface GroupSearchResult extends PaginatedResult<GroupSearchSet> {
  searchResult: GroupSearchSet[];
}

export interface GroupSearchSet {
  groupId: number;
  groupName: string;
  beginDate: string;
  endDate: string;
  statusDescription: string;
}

// ==================== Message Models ====================
export interface MessageSendRequest {
  recipientId: string;
  body: string;
}

export interface MessageSendResult {
  messageId: number;
  status: string;
  recipientId: string;
  body: string;
  timestamp: string;
}

export interface EmailSendRequest {
  toEmail: string;
  subject: string;
  content: string;
}

export interface EmailSendResult {
  emailId: number;
  status: string;
  toEmail: string;
  subject: string;
  timestamp: string;
  moduleName?: string;
}
