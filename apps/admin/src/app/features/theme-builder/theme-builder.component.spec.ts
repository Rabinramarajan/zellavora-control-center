import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ThemeBuilderComponent } from './theme-builder.component';
import { ThemeBuilderRepository } from '@core/repositories/theme-builder.repository';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';

describe('ThemeBuilderComponent', () => {
  let component: ThemeBuilderComponent;
  let fixture: ComponentFixture<ThemeBuilderComponent>;
  let repoMock: jasmine.SpyObj<ThemeBuilderRepository>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('ThemeBuilderRepository', ['loadThemeConfig', 'saveThemeConfig']);
    spy.loadThemeConfig.and.returnValue(of({
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#3b82f6',
      secondaryColor: '#1e293b',
      fontFamily: 'Inter',
      borderRadius: 8,
      spacing: 4,
      isDarkMode: false,
    }));

    TestBed.configureTestingModule({
      imports: [FormsModule, ThemeBuilderComponent],
      providers: [
        { provide: ThemeBuilderRepository, useValue: spy },
      ],
    });

    fixture = TestBed.createComponent(ThemeBuilderComponent);
    component = fixture.componentInstance;
    repoMock = TestBed.inject(ThemeBuilderRepository) as jasmine.SpyObj<ThemeBuilderRepository>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load config on init', () => {
    expect(component.primaryColor).toBe('#3b82f6');
    expect(repoMock.loadThemeConfig).toHaveBeenCalled();
  });
});
