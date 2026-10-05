import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MessageService } from 'primeng/api';
import { TimesheetExportService } from '../../data/timesheet-export.service';
import { TimesheetReport } from '../../data/timesheet-report';
import { reportToHtml } from '../../data/timesheet-report-html';

type ExportAction = 'pdf' | 'docx' | 'csv' | 'print';

/**
 * The timesheet exactly as it will be exported, with the download actions.
 * PDF and Word are built in the browser; CSV comes from the API so it stays
 * importable.
 */
@Component({
  selector: 'app-timesheet-report-preview',
  templateUrl: './timesheet-report-preview.component.html',
  styleUrl: './timesheet-report-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesheetReportPreviewComponent {
  public readonly report = input.required<TimesheetReport>();
  /** The CSV export lives on the API; the parent supplies it. */
  public readonly csvRequested = output<void>();

  private readonly exporter = inject(TimesheetExportService);
  private readonly messages = inject(MessageService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly busy = signal<ExportAction | null>(null);

  /**
   * reportToHtml escapes every value and emits no script, and the frame is
   * sandboxed without allow-scripts, so trusting the markup is safe here.
   */
  protected readonly document = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(reportToHtml(this.report()))
  );

  protected async run(action: ExportAction): Promise<void> {
    if (this.busy()) return;
    if (action === 'csv') {
      this.csvRequested.emit();
      return;
    }
    if (action === 'print') {
      this.print();
      return;
    }

    this.busy.set(action);
    try {
      if (action === 'pdf') await this.exporter.exportPdf(this.report());
      else await this.exporter.exportDocx(this.report());
    } catch {
      this.messages.add({
        severity: 'error',
        summary: 'Export failed',
        detail: `The ${action === 'pdf' ? 'PDF' : 'Word'} file could not be created. Please try again.`,
      });
    } finally {
      this.busy.set(null);
    }
  }

  /**
   * Prints from a short-lived frame rather than the preview: the preview is
   * sandboxed without scripts, and Chrome counts calling print() on it as
   * script execution and blocks it. The document is the same escaped,
   * script-free markup, so dropping the sandbox here grants nothing.
   */
  private print(): void {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    Object.assign(frame.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      visibility: 'hidden',
    });

    frame.onload = () => {
      const view = frame.contentWindow;
      if (!view) {
        frame.remove();
        return;
      }
      // Removed only after the dialog closes; removing early cancels the print.
      view.addEventListener('afterprint', () => frame.remove(), { once: true });
      window.setTimeout(() => frame.isConnected && frame.remove(), 60_000);
      view.focus();
      view.print();
    };
    frame.srcdoc = reportToHtml(this.report());
    document.body.appendChild(frame);
  }
}
