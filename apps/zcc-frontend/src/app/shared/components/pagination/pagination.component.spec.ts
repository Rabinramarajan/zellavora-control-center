import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageChangeEvent, PaginationComponent, buildPageItems } from './pagination.component';

const values = (items: ReturnType<typeof buildPageItems>) =>
  items.map((item) => (item.type === 'page' ? item.value : '…'));

describe('buildPageItems', () => {
  it('lists every page when they all fit', () => {
    expect(values(buildPageItems(1, 5))).toEqual([1, 2, 3, 4, 5]);
    expect(values(buildPageItems(1, 7))).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('collapses the tail near the start', () => {
    expect(values(buildPageItems(1, 20))).toEqual([1, 2, 3, 4, 5, '…', 20]);
  });

  it('collapses both sides in the middle', () => {
    expect(values(buildPageItems(10, 20))).toEqual([1, '…', 9, 10, 11, '…', 20]);
  });

  it('collapses the head near the end', () => {
    expect(values(buildPageItems(20, 20))).toEqual([1, '…', 16, 17, 18, 19, 20]);
  });

  it('keeps a constant item count so the control does not jump', () => {
    for (let page = 1; page <= 30; page++) {
      expect(buildPageItems(page, 30).length).toBe(7);
    }
  });
});

describe('PaginationComponent', () => {
  let fixture: ComponentFixture<PaginationComponent>;
  let component: PaginationComponent;
  let events: PageChangeEvent[];

  const setInput = (key: string, value: unknown) => fixture.componentRef.setInput(key, value);

  beforeEach(() => {
    fixture = TestBed.createComponent(PaginationComponent);
    component = fixture.componentInstance;
    events = [];
    component.paginate.subscribe((event) => events.push(event));
    setInput('totalItems', 95);
    fixture.detectChanges();
  });

  it('derives page count and range', () => {
    expect(component.totalPages()).toBe(10);
    expect(component.rangeStart()).toBe(1);
    expect(component.rangeEnd()).toBe(10);
  });

  it('clamps an out-of-range page for rendering', () => {
    setInput('page', 42);
    expect(component.currentPage()).toBe(10);
    expect(component.rangeEnd()).toBe(95);
  });

  it('navigates and emits the resulting window', () => {
    component.goTo(3);
    expect(component.page()).toBe(3);
    expect(events).toEqual([{ page: 3, pageSize: 10, startIndex: 20, endIndex: 30 }]);
  });

  it('ignores navigation to the current page or while disabled', () => {
    component.goTo(1);
    setInput('disabled', true);
    component.next();
    expect(events.length).toBe(0);
  });

  it('resets to page 1 on page-size change in a single event', () => {
    component.goTo(4);
    events = [];
    component.setPageSize(25);
    expect(component.pageSize()).toBe(25);
    expect(component.page()).toBe(1);
    expect(events).toEqual([{ page: 1, pageSize: 25, startIndex: 0, endIndex: 25 }]);
  });

  it('marks the current page for assistive tech', () => {
    component.goTo(2);
    fixture.detectChanges();
    const current = fixture.nativeElement.querySelector('[aria-current="page"]');
    expect(current.textContent.trim()).toBe('2');
  });
});
