import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BreadcrumbComponent } from './breadcrumb.component';
import { BreadcrumbItem } from '../../models';

describe('BreadcrumbComponent', () => {
  let fixture: ComponentFixture<BreadcrumbComponent>;

  const trail = (count: number): BreadcrumbItem[] =>
    Array.from({ length: count }, (_, index) => ({
      label: `Step ${index + 1}`,
      url: index === count - 1 ? null : `/step-${index + 1}`,
    }));

  const text = (selector: string): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll(selector)).map((el) =>
      (el as HTMLElement).textContent!.trim()
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(BreadcrumbComponent);
  });

  it('links every step but the current one', () => {
    fixture.componentRef.setInput('items', trail(3));
    fixture.detectChanges();

    expect(text('.breadcrumb__link')).toEqual(['Step 1', 'Step 2']);
    expect(text('.breadcrumb__current')).toEqual(['Step 3']);
  });

  it('marks the current step for assistive technology', () => {
    fixture.componentRef.setInput('items', trail(2));
    fixture.detectChanges();

    const current: HTMLElement = fixture.nativeElement.querySelector('.breadcrumb__current');
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(fixture.nativeElement.querySelector('nav').getAttribute('aria-label')).toBe(
      'Breadcrumb'
    );
  });

  it('collapses the middle of a long trail and names the hidden steps', () => {
    fixture.componentRef.setInput('items', trail(6));
    fixture.componentRef.setInput('maxItems', 3);
    fixture.detectChanges();

    expect(text('.breadcrumb__link').concat(text('.breadcrumb__current'))).toEqual([
      'Step 1',
      'Step 5',
      'Step 6',
    ]);
    expect(text('.breadcrumb__sr-only')).toEqual(['Step 2, Step 3, Step 4']);
  });

  it('renders nothing when there is no trail', () => {
    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
  });
});
