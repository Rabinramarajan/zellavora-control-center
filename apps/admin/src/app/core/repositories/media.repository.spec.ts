import { TestBed } from '@angular/core/testing';
import { MediaRepository } from './media.repository';
import { MediaApiService } from '@core/api/media.api';
import { of } from 'rxjs';
import { MediaFile } from '@shared/models';

describe('MediaRepository', () => {
  let repository: MediaRepository;
  let apiMock: jasmine.SpyObj<MediaApiService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('MediaApiService', [
      'getMediaFiles',
      'uploadFile',
      'deleteFile',
    ]);

    TestBed.configureTestingModule({
      providers: [
        MediaRepository,
        { provide: MediaApiService, useValue: spy },
      ],
    });

    repository = TestBed.inject(MediaRepository);
    apiMock = TestBed.inject(MediaApiService) as jasmine.SpyObj<MediaApiService>;
  });

  it('should load files and update signal', () => {
    const mockFiles: MediaFile[] = [{ id: '1', filename: 'test.png' } as any];
    apiMock.getMediaFiles.and.returnValue(of(mockFiles));

    repository.loadFiles().subscribe(() => {
      expect(repository.files()).toEqual(mockFiles);
      expect(repository.loading()).toBeFalse();
    });
  });
});
