import { TestBed } from '@angular/core/testing';
import { UserRepository } from './user.repository';
import { UserApiService } from '@core/api/user.api';
import { of } from 'rxjs';
import { AuthUser } from '@shared/models';

describe('UserRepository', () => {
  let repository: UserRepository;
  let apiMock: jasmine.SpyObj<UserApiService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('UserApiService', [
      'getUsers',
      'getUserById',
      'createUser',
      'updateUser',
      'deleteUser',
    ]);

    TestBed.configureTestingModule({
      providers: [
        UserRepository,
        { provide: UserApiService, useValue: spy },
      ],
    });

    repository = TestBed.inject(UserRepository);
    apiMock = TestBed.inject(UserApiService) as jasmine.SpyObj<UserApiService>;
  });

  it('should load users and update signals', () => {
    const mockUsers: AuthUser[] = [{ id: '1', email: 'test@test.com' } as any];
    apiMock.getUsers.and.returnValue(of(mockUsers));

    repository.loadUsers().subscribe(() => {
      expect(repository.users()).toEqual(mockUsers);
      expect(repository.loading()).toBeFalse();
    });
  });
});
