import { BranchItem } from '../../../../../shared/models/iam-admin.model';
import { branchFields, toBranchRequest } from './branch-form';

const branch: BranchItem = {
  id: 'b1',
  code: 'BR-0003',
  name: 'Chennai',
  isHeadOffice: true,
  address: null,
  city: 'Chennai',
  state: null,
  country: 'India',
  pincode: null,
  phone: null,
  email: null,
  status: 'active',
  userCount: 2,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('branch form', () => {
  it('always shows the code read-only and never sends it', () => {
    const code = branchFields(branch).find((f) => f.key === 'code');
    expect(code?.disabled).toBeTrue();
    expect(code?.value).toBe('BR-0003');
    expect('code' in toBranchRequest({ code: 'BR-9999', name: 'X' })).toBeFalse();
  });

  it('locks the head-office toggle on the current head office', () => {
    expect(branchFields(branch).find((f) => f.key === 'isHeadOffice')?.disabled).toBeTrue();
    expect(branchFields().find((f) => f.key === 'isHeadOffice')?.disabled).toBeFalse();
  });

  it('disables every field in view mode', () => {
    expect(branchFields(branch, true).every((f) => f.disabled)).toBeTrue();
  });

  it('trims values and turns blanks into null', () => {
    expect(
      toBranchRequest({
        name: '  Pune  ',
        status: 'inactive',
        isHeadOffice: false,
        city: '   ',
        email: ' ops@acme.io ',
      })
    ).toEqual({
      name: 'Pune',
      status: 'inactive',
      isHeadOffice: false,
      address: null,
      city: null,
      state: null,
      country: null,
      pincode: null,
      phone: null,
      email: 'ops@acme.io',
    });
  });
});
