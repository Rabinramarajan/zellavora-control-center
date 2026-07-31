import { Invitation } from '@prisma/client';
import { InvitationService } from './invitation.service';
import { InvitationRepository } from './invitation.repository';

jest.mock('./invitation.repository');

describe('InvitationService', () => {
  let service: InvitationService;
  let mockRepo: jest.Mocked<InvitationRepository>;

  beforeEach(() => {
    mockRepo = new InvitationRepository() as jest.Mocked<InvitationRepository>;
    service = new InvitationService();
    (service as any).repo = mockRepo;
  });

  it('should successfully verify a valid invitation code', async () => {
    const mockInvite = { id: '1', email: 'test@zellavora.com', code: 'ZCC-XYZ', used: false, createdAt: new Date() } as Invitation;
    mockRepo.findByCode.mockResolvedValue(mockInvite);

    const result = await service.verify('ZCC-XYZ');
    expect(result).toEqual(mockInvite);
  });

  it('should throw an error for an invalid invitation code', async () => {
    mockRepo.findByCode.mockResolvedValue(null);

    await expect(service.verify('INVALID-CODE')).rejects.toThrow('Invalid or expired invitation code');
  });
});
