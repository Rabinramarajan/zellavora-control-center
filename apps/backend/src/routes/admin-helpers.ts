import { Response } from 'express';

// Shared User UUID/Serial Mapping
export const userUuidToSerial = new Map<string, number>();
export const userSerialToUuid = new Map<number, string>();
let nextUserSerial = 1;

export function getOrAddUserSerial(uuid: string): number {
  if (userUuidToSerial.has(uuid)) {
    return userUuidToSerial.get(uuid)!;
  }
  const serial = nextUserSerial++;
  userUuidToSerial.set(uuid, serial);
  userSerialToUuid.set(serial, uuid);
  return serial;
}

export function getUserUuidFromSerial(serial: number): string | undefined {
  return userSerialToUuid.get(serial);
}

// Shared Role UUID/Serial Mapping
export const roleUuidToSerial = new Map<string, number>();
export const roleSerialToUuid = new Map<number, string>();
let nextRoleSerial = 1;

export function getOrAddRoleSerial(uuid: string): number {
  if (roleUuidToSerial.has(uuid)) {
    return roleUuidToSerial.get(uuid)!;
  }
  const serial = nextRoleSerial++;
  roleUuidToSerial.set(uuid, serial);
  roleSerialToUuid.set(serial, uuid);
  return serial;
}

export function getRoleUuidFromSerial(serial: number): string | undefined {
  return roleSerialToUuid.get(serial);
}

// Response Wrapper
export const wrapResponse = (data: any) => ({
  data,
  infoMessage: { msgID: 0, msgType: 'Info', msgDescription: '' },
  errorMessage: [],
  hasError: false
});

// Shared Mock Branch Data
export let mockBranches = [
  {
    admBranchId: 1,
    actCompanyId: 1,
    admLocationId: 1,
    admRegionId: 1,
    branchName: 'Headquarters',
    effectiveDate: '2026-01-01T00:00:00Z',
    statusId: 1,
    statusValue: 'Active',
    branchCode: 'HQ-001'
  },
  {
    admBranchId: 2,
    actCompanyId: 1,
    admLocationId: 1,
    admRegionId: 1,
    branchName: 'New York Branch',
    effectiveDate: '2026-01-01T00:00:00Z',
    statusId: 1,
    statusValue: 'Active',
    branchCode: 'NY-002'
  }
];
