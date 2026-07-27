import { TestBed } from '@angular/core/testing';
import { ProjectRepository } from './project.repository';
import { ProjectApiService } from '@core/api/project.api';
import { of, throwError } from 'rxjs';
import { Project } from '@shared/models';

describe('ProjectRepository', () => {
  let repository: ProjectRepository;
  let apiMock: jasmine.SpyObj<ProjectApiService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('ProjectApiService', [
      'getProjects',
      'getProjectById',
      'createProject',
      'updateProject',
      'deleteProject',
    ]);

    TestBed.configureTestingModule({
      providers: [
        ProjectRepository,
        { provide: ProjectApiService, useValue: spy },
      ],
    });

    repository = TestBed.inject(ProjectRepository);
    apiMock = TestBed.inject(ProjectApiService) as jasmine.SpyObj<ProjectApiService>;
  });

  it('should load projects and update signals', () => {
    const mockProjects: Project[] = [{ id: '1', title: 'Test' } as any];
    apiMock.getProjects.and.returnValue(of(mockProjects));

    repository.loadProjects().subscribe(() => {
      expect(repository.projects()).toEqual(mockProjects);
      expect(repository.loading()).toBeFalse();
    });
  });
});
