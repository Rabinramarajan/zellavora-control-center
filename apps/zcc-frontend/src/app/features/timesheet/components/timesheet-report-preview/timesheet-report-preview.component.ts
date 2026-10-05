import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
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
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

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

  private print(): void {
    const view = this.frame()?.nativeElement.contentWindow;
    if (!view) return;
    view.focus();
    view.print();
  }
}
