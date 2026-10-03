import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilterChipsComponent } from './filter-chips.component';

describe('FilterChipsComponent', () => {
  let fixture: ComponentFixture<FilterChipsComponent<string>>;
  let component: FilterChipsComponent<string>;
  let emitted: (string | null | undefined)[];

  const buttons = () =>
    Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

  beforeEach(() => {
    fixture = TestBed.createComponent(FilterChipsComponent<string>);
    component = fixture.componentInstance;
    emitted = [];
    component.selected.subscribe((v) => emitted.push(v));
    fixture.componentRef.setInput('options', [
      { value: 'a', label: 'A', count: 3 },
      { value: 'b', label: 'B', count: null },
    ]);
    fixture.componentRef.setInput('allCount', 3);
    fixture.detectChanges();
  });

  it('renders an "All" chip plus one per option with counts', () => {
    expect(buttons().map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'All 3',
      'A 3',
      'B …',
    ]);
  });

  it('marks "All" pressed when nothing is selected', () => {
    expect(buttons()[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('selects a chip and toggles it back to null', () => {
    buttons()[1].click();
    fixture.detectChanges();
    expect(buttons()[1].getAttribute('aria-pressed')).toBe('true');
    buttons()[1].click();
    expect(emitted).toEqual(['a', null]);
  });

  it('highlights nothing when selected is undefined', () => {
    fixture.componentRef.setInput('selected', undefined);
    fixture.detectChanges();
    expect(buttons().every((b) => b.getAttribute('aria-pressed') === 'false')).toBeTrue();
  });
});
