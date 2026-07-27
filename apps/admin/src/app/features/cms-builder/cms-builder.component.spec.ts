import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CmsBuilderComponent } from './cms-builder.component';
import { CmsBuilderRepository } from '@core/repositories/cms-builder.repository';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';

describe('CmsBuilderComponent', () => {
  let component: CmsBuilderComponent;
  let fixture: ComponentFixture<CmsBuilderComponent>;
  let repoMock: jasmine.SpyObj<CmsBuilderRepository>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('CmsBuilderRepository', ['loadPages', 'savePage']);
    spy.loadPages.and.returnValue(of([]));
    spy.savePage.and.returnValue(of({} as any));

    TestBed.configureTestingModule({
      imports: [FormsModule, CmsBuilderComponent],
      providers: [
        { provide: CmsBuilderRepository, useValue: spy },
      ],
    });

    fixture = TestBed.createComponent(CmsBuilderComponent);
    component = fixture.componentInstance;
    repoMock = TestBed.inject(CmsBuilderRepository) as jasmine.SpyObj<CmsBuilderRepository>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
