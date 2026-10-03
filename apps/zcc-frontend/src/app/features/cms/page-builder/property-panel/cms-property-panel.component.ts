import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CmsSection, CmsDevice } from '../../../../shared/models';
import { IAM_INPUT } from '../../../iam/shared/iam-page-header.component';

@Component({
  selector: 'app-cms-property-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cms-property-panel.component.html',
  styleUrl: './cms-property-panel.component.scss',
})
export class CmsPropertyPanelComponent {
  readonly section = input<CmsSection | null>(null);
  readonly device = input<CmsDevice>('desktop');

  readonly update = output<CmsSection>();

  protected readonly inputClass = IAM_INPUT;

  protected readonly props = computed(() => this.section()?.props ?? {});

  protected getProp(key: string): string {
    return (this.props()[key] as string) ?? '';
  }

  protected setProp(key: string, value: string): void {
    const s = this.section();
    if (!s) return;
    this.update.emit({ ...s, props: { ...s.props, [key]: value } });
  }

  protected setTitle(value: string): void {
    const s = this.section();
    if (!s) return;
    this.update.emit({ ...s, title: value });
  }

  protected setStyle(key: string, value: string): void {
    const s = this.section();
    if (!s) return;
    const device = this.device();
    const styles = { ...s.styles, [device]: { ...(s.styles?.[device] ?? {}), [key]: value } };
    this.update.emit({ ...s, styles });
  }

  protected getStyle(key: string): string {
    const s = this.section();
    if (!s) return '';
    const deviceStyles = s.styles?.[this.device()] ?? {};
    return (deviceStyles[key] as string) ?? '';
  }
}
