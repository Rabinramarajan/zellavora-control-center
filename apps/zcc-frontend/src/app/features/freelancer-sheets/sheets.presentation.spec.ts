import { approvalCopy, statusLabel, statusesFor } from './sheets.presentation';

describe('sheet presentation under approval modes', () => {
  it('calls an approved sheet final when nobody reviews', () => {
    expect(statusLabel('approved', 'NONE')).toBe('Finalized');
    expect(statusLabel('approved', 'EXTERNAL')).toBe('Approved');
    expect(statusLabel('submitted')).toBe('Pending');
  });

  it('drops pending and rejected filters when submitting finalizes', () => {
    const all = ['draft', 'submitted', 'approved', 'rejected'] as const;
    expect(statusesFor(all, 'NONE')).toEqual(['draft', 'approved']);
    expect(statusesFor(all, 'SELF')).toEqual([...all]);
  });

  it('offers Finalize and reopening only where the owner signs off', () => {
    expect(approvalCopy('NONE').submit).toBe('Finalize');
    expect(approvalCopy('NONE').canReopen).toBeTrue();
    expect(approvalCopy('SELF').canReopen).toBeTrue();
    expect(approvalCopy('EXTERNAL').canReopen).toBeFalse();
  });
});
