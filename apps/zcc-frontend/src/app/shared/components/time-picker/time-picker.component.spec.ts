import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { TimePickerComponent } from './time-picker.component';

@Component({
  imports: [FormsModule, TimePickerComponent],
  template: `<app-time-picker [(ngModel)]="value" ariaLabel="Start" [step]="30" />`,
})
class HostComponent {
  public value = signal<string | null>('10:00 AM');
}

describe('TimePickerComponent', () => {
  const setup = async () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    return { fixture, input };
  };

  const type = async (
    fixture: { whenStable(): Promise<unknown> },
    input: HTMLInputElement,
    text: string
  ) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };

  it('shows the bound value', async () => {
    const { input } = await setup();
    expect(input.value).toBe('10:00 AM');
  });

  it('normalises typed text when the field loses focus', async () => {
    const { fixture, input } = await setup();
    await type(fixture, input, '8p');
    expect(input.value).toBe('8:00 PM');
    expect(fixture.componentInstance.value()).toBe('8:00 PM');
  });

  it('reverts unreadable text instead of saving it', async () => {
    const { fixture, input } = await setup();
    await type(fixture, input, 'later');
    expect(input.value).toBe('10:00 AM');
    expect(fixture.componentInstance.value()).toBe('10:00 AM');
  });

  it('clears to null', async () => {
    const { fixture, input } = await setup();
    await type(fixture, input, '');
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('opens the list with the keyboard and picks the highlighted time', async () => {
    const { fixture, input } = await setup();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await fixture.whenStable();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelectorAll('.tp-option').length).toBe(48);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('10:30 AM');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
});
