# Document upload

Open `DocumentUploadComponent` through `AppDialogService` (see `shared/components/dialog`):

```ts
this.dialog.open<DocumentUploadComponent, DocumentUploadDialogData>(DocumentUploadComponent, {
  data: { uploadFile: this.uploadDocument, maxSizeMb: 25 },
  size: 'xl',
  width: 'min(1080px, calc(100vw - 32px))',
});
```

`data.uploadFile` is a `DocumentUploadHandler`: `(file, progress) => Promise<{ uploadedBy?, uploadedOn? }>`. Resolve after persistence, reject on failure. Report progress only if supported by your transport; otherwise the UI shows an indeterminate uploading state. Failed files remain available for retry; successful files are not re-uploaded.

The dialog owns its queue using signals, computed values, and OnPush change detection; it reads its options from the dialog data. `DocumentDropzoneComponent` can also be used independently via its `filesSelected` output. Optional data fields are `title`, `subtitle`, and `maxSizeMb` (default 25).

PDF, JPG/JPEG, and PNG are supported. Client validation checks extension, MIME type when available, non-empty files, size, and duplicates. The server must validate content and authorization separately. Removing a row only removes it from the local selection, never from server storage. Close, Cancel, Escape, and backdrop clicks are disabled during uploads. Cancel discards pending selections; completed uploads remain saved.

The Media Gallery integration uses its existing API and 3 MB server limit. That API does not expose upload percentages or uploader names, so percentages are not fabricated and the uploader column shows an em dash.
