import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { APP_DIALOG_TITLE_ID } from '@shared/components/dialog';
import { FormDialogData, IamFormDialogComponent } from './iam-form-dialog.component';

describe('IamFormDialogComponent', () => {
  let close: jasmine.Spy;

  const setup = (data: FormDialogData) => {
    close = jasmine.createSpy('close');
    TestBed.configureTestingModule({
      imports: [IamFormDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close } },
        { provide: APP_DIALOG_TITLE_ID, useValue: 'title' },
      ],
    });
    const fixture = TestBed.createComponent(IamFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  };

  const submit = async (fixture: ReturnType<typeof setup>) => {
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const type = (fixture: ReturnType<typeof setup>, selector: string, value: string) => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('blocks submit and shows errors for invalid fields', async () => {
    const submitSpy = jasmine.createSpy('submit').and.resolveTo(undefined);
    const fixture = setup({
      title: 'Invite',
      fields: [{ key: 'email', label: 'Email', type: 'email', required: true }],
      submit: submitSpy,
    });

    await submit(fixture);
    expect(fixture.nativeElement.textContent).toContain('Email is required.');

    type(fixture, 'input[type=email]', 'not-an-email');
    await submit(fixture);
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address.');
    expect(submitSpy).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('submits trimmed values and closes on success', async () => {
    const submitSpy = jasmine.createSpy('submit').and.resolveTo(undefined);
    const fixture = setup({
      title: 'Team',
      fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
      submit: submitSpy,
    });

    type(fixture, 'input[type=text]', '  Platform  ');
    await submit(fixture);

    expect(submitSpy).toHaveBeenCalledWith({ name: 'Platform' });
    expect(close).toHaveBeenCalledWith({ name: 'Platform' });
  });

  it('keeps the dialog open and shows the server error when submit fails', async () => {
    const fixture = setup({
      title: 'Team',
      fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
      submit: () =>
        Promise.reject({ status: 409, message: "A team named 'Platform' already exists." }),
    });

    type(fixture, 'input[type=text]', 'Platform');
    await submit(fixture);

    expect(close).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'already exists'
    );
  });

  it('validates number ranges', async () => {
    const fixture = setup({
      title: 'Policy',
      fields: [{ key: 'n', label: 'Attempts', type: 'number', required: true, min: 3, max: 20 }],
      submit: () => Promise.resolve(),
    });
    type(fixture, 'input[type=number]', '2');
    await submit(fixture);
    expect(fixture.nativeElement.textContent).toContain('Must be at least 3.');
  });
});
