import { InvitationRepository } from './invitation.repository';
import { AppError } from '../../middleware/error';

export class InvitationService {
  private readonly repo = new InvitationRepository();

  async verify(code: string) {
    const invite = await this.repo.findByCode(code);
    if (!invite) {
      throw new AppError('Invalid or expired invitation code', 400, 'INVALID_INVITATION');
    }
    return invite;
  }

  async generate(email: string) {
    const code = 'ZCC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    return this.repo.create(email, code);
  }
}
