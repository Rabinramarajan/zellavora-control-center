import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { AppDialogService, APP_DIALOG_TITLE_ID } from '../dialog';
import { FormDialogComponent } from './form-dialog.component';
import { FormDialogConfig } from './form-dialog.types';
import { validateField } from './form-dialog.validation';

describe('FormDialogComponent', () => {
  let close: jasmine.Spy;
  let confirm: jasmine.Spy;

  const setup = (overrides: Partial<FormDialogConfig<string>> = {}) => {
    close = jasmine.createSpy('close');
    confirm = jasmine.createSpy('confirm').and.returnValue(of(true));
    const config: FormDialogConfig<string> = {
      mode: 'create',
      title: { create: 'Create', edit: 'Edit', view: 'Details' },
      sections: [
        {
          title: 'Basic Information',
          fields: [
            { key: 'name', label: 'Name', type: 'text', required: true, minLength: 2 },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'code', label: 'Code', type: 'text', readonly: true },
          ],
        },
      ],
      value: { name: '', email: '', code: 'BR-0001' },
      save: jasmine.createSpy('save').and.resolveTo('saved'),
      ...overrides,
    };
    TestBed.configureTestingModule({
      imports: [FormDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: config },
        { provide: DialogRef, useValue: { close } },
        { provide: APP_DIALOG_TITLE_ID, useValue: 'title' },
        { provide: AppDialogService, useValue: { confirm } },
      ],
    });
    const fixture = TestBed.createComponent(FormDialogComponent);
    fixture.detectChanges();
    return { fixture, config, el: fixture.nativeElement as HTMLElement };
  };

  const type = (el: HTMLElement, id: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(`[id$="-${id}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  const submit = async (fixture: ReturnType<typeof setup>['fixture']) => {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('shows validation errors and does not save an invalid form', async () => {
    const { fixture, config, el } = setup();
    type(el, 'email', 'user@');
    await submit(fixture);
    expect(config.save).not.toHaveBeenCalled();
    const errors = Array.from(el.querySelectorAll('.fd-message--error')).map((e) =>
      e.textContent?.trim()
    );
    expect(errors).toEqual(['Name is required.', 'Enter a valid email address.']);
  });

  it('saves trimmed values without read-only fields and closes with the result', async () => {
    const { fixture, config, el } = setup();
    type(el, 'name', '  Chennai  ');
    await submit(fixture);
    expect(config.save).toHaveBeenCalledWith({ name: 'Chennai', email: null }, 'create');
    expect(close).toHaveBeenCalledWith('saved');
  });

  it('keeps the dialog open and shows the server error when saving fails', async () => {
    const { fixture, el } = setup({
      save: jasmine.createSpy('save').and.rejectWith({ error: { message: 'Name taken' } }),
    });
    type(el, 'name', 'Chennai');
    await submit(fixture);
    expect(close).not.toHaveBeenCalled();
    expect(el.querySelector('.fd-alert')?.textContent).toContain('Name taken');
  });

  it('asks before discarding unsaved changes', async () => {
    confirm = jasmine.createSpy();
    const { fixture, el } = setup();
    confirm.and.returnValue(of(false));
    type(el, 'name', 'Draft');
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.fd-close')!.click();
    await fixture.whenStable();
    expect(confirm).toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('closes without asking when nothing changed', async () => {
    const { fixture, el } = setup();
    el.querySelector<HTMLButtonElement>('.fd-close')!.click();
    await fixture.whenStable();
    expect(confirm).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(null);
  });

  it('renders read-only values in view mode and switches to edit in place', () => {
    const { fixture, el } = setup({
      mode: 'view',
      canEdit: true,
      value: { name: 'Chennai', email: '', code: 'BR-0001' },
    });
    expect(el.querySelector('input')).toBeNull();
    expect(el.querySelector('.fd-header__title')?.textContent).toContain('Details');
    Array.from(el.querySelectorAll<HTMLButtonElement>('.fd-btn'))
      .find((b) => b.textContent?.includes('Edit'))!
      .click();
    fixture.detectChanges();
    expect(el.querySelector('.fd-header__title')?.textContent).toContain('Edit');
    expect(el.querySelector('input')).not.toBeNull();
  });
});

describe('validateField', () => {
  it('applies length, number and pattern rules', () => {
    expect(validateField({ key: 'a', label: 'A', type: 'text', maxLength: 3 }, 'abcd')).toContain(
      'at most 3'
    );
    expect(validateField({ key: 'n', label: 'N', type: 'number', min: 1 }, 0)).toContain(
      'at least 1'
    );
    expect(validateField({ key: 't', label: 'T', type: 'tel' }, 'abc')).not.toBeNull();
    expect(
      validateField({ key: 'c', label: 'Terms', type: 'checkbox', required: true }, false)
    ).toBe('Terms must be accepted.');
  });
});
