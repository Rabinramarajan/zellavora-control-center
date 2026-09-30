# Reusable CDK Dialog

Angular 22 · standalone · signals · OnPush · zoneless-safe · `@angular/cdk/dialog` only (no Material dialog).

```
shared/components/dialog/
├── app-dialog.service.ts      open / confirm / alert / prompt / closeAll
├── dialog-shell.component.ts  common chrome (title, close, body, actions)
├── confirm-dialog.component.ts
├── prompt-dialog.component.ts
├── dialog.types.ts
├── dialog.inject.ts           injectDialogData / injectDialogRef
├── _dialog.scss               panel, backdrop, animations, buttons
└── index.ts
```

## Setup

```scss
// styles.scss
@use '@angular/cdk/overlay-prebuilt.css';
@use '../app/shared/components/dialog/dialog';
```

No providers needed — `Dialog` and `AppDialogService` are `providedIn: 'root'`.

## 1. Confirm / alert

```ts
readonly #dialog = inject(AppDialogService);

deleteUser(user: User) {
  this.#dialog
    .confirm({
      title: 'Delete user?',
      message: `${user.name} will be removed permanently.`,
      confirmText: 'Delete',
      variant: 'danger',
    })
    .pipe(filter(Boolean), switchMap(() => this.api.delete(user.id)))
    .subscribe();
}

// Promise style
const ok = await firstValueFrom(this.#dialog.confirm({ title: 'Discard changes?', message: '' }));

this.#dialog.alert({ title: 'Saved', message: 'Your changes are live.' });

// Text input — emits the trimmed value, or null when dismissed
const name = await firstValueFrom(
  this.#dialog.prompt({ title: 'Copy role', label: 'New role name', required: true }),
);
```

## 2. Custom dialog component

```ts
export interface EditUserData { user: User }

@Component({
  selector: 'app-edit-user-dialog',
  imports: [DialogShellComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-shell title="Edit user" [subtitle]="data.user.email" [busy]="saving()">
      <form [formGroup]="form" id="edit-user-form" (ngSubmit)="save()">
        <label>Name <input formControlName="name" /></label>
      </form>

      <button dialogActions type="button" class="app-dialog-btn app-dialog-btn--ghost" (click)="ref.close()">
        Cancel
      </button>
      <button dialogActions type="submit" form="edit-user-form" class="app-dialog-btn" [disabled]="saving()">
        Save
      </button>
    </app-dialog-shell>
  `,
})
export class EditUserDialogComponent {
  protected readonly data = injectDialogData<EditUserData>();
  protected readonly ref = injectDialogRef<User>();
  readonly #api = inject(UserApi);

  protected readonly saving = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({ name: this.data.user.name });

  save() {
    this.saving.set(true);
    this.ref.disableClose = true;               // lock while saving
    this.#api.update(this.data.user.id, this.form.getRawValue()).subscribe({
      next: (u) => this.ref.close(u),
      error: () => { this.saving.set(false); this.ref.disableClose = false; },
    });
  }
}
```

Open it — fully typed data and result:

```ts
this.#dialog
  .open<EditUserDialogComponent, EditUserData, User>(EditUserDialogComponent, {
    data: { user },
    size: 'md',
  })
  .closed.subscribe((updated) => updated && this.users.reload());
```

## 3. Drawer / bottom sheet / full screen

```ts
this.#dialog.open(FiltersPanelComponent, { position: 'right', size: 'sm' }); // side drawer
this.#dialog.open(ShareSheetComponent, { position: 'bottom' });              // bottom sheet
this.#dialog.open(ReportViewerComponent, { size: 'full' });                  // full screen
```

## Config reference (`AppDialogConfig<D>`)

| Option | Default | Notes |
|---|---|---|
| `data` | — | Read with `injectDialogData<D>()` |
| `size` | `'md'` | `sm` 400 · `md` 560 · `lg` 800 · `xl` 1140 · `full` |
| `position` | `'center'` | `center` · `right` · `left` · `bottom` |
| `width` / `height` / `maxHeight` | from preset | Override the preset |
| `disableClose` | `false` | Blocks Escape + backdrop click |
| `hasBackdrop` | `true` | |
| `panelClass` / `backdropClass` | — | Added to the defaults |
| `ariaLabel` | — | Only if you don't use `<app-dialog-shell>` |
| `autoFocus` | `'first-tabbable'` | Honors `cdkFocusInitial` |
| `restoreFocus` | `true` | |
| `closeOnNavigation` | `true` | |

## Shell inputs (`<app-dialog-shell>`)

| Input | Default | |
|---|---|---|
| `title` | `''` | Or project `[dialogTitle]` content |
| `subtitle` | — | |
| `showClose` | `true` | X button |
| `busy` | `false` | Progress bar + disables X |
| `closeResult` | `undefined` | Value emitted when X is clicked |
| `actionsAlign` | `'end'` | `end` · `start` · `between` |

Slots: default = body (scrolls), `[dialogActions]` = footer (hidden when empty).

## Service extras

- `hasOpenDialogs` — signal, `true` while any dialog is open
- `closeAll()` — e.g. on logout

## Theming

All colors come from `--app-dialog-*` variables that fall back to Material M3 `--mat-sys-*` tokens, so it picks up your theme automatically. Override any variable on `:root` or a panel class.
