import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CmsPage } from '../../../../shared/models';
import { IAM_INPUT } from '../../../iam/shared/iam-page-header.component';

@Component({
  selector: 'app-cms-page-settings-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cms-page-settings-panel.component.html',
  styleUrl: './cms-page-settings-panel.component.scss',
})
export class CmsPageSettingsPanelComponent {
  readonly page = input.required<CmsPage>();

  readonly update = output<Partial<CmsPage>>();

  protected readonly inputClass = IAM_INPUT;

  protected readonly seoTitleLen = computed(() => (this.page().seo?.seoTitle ?? '').length);
  protected readonly metaDescLen = computed(() => (this.page().seo?.metaDescription ?? '').length);

  protected setSeo(key: string, value: string): void {
    this.update.emit({ seo: { ...this.page().seo, [key]: value } });
  }

  protected set(key: keyof CmsPage, value: string): void {
    this.update.emit({ [key]: value } as Partial<CmsPage>);
  }
}
