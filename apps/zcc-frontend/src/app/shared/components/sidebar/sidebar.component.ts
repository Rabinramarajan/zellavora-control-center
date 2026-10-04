import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { SidebarNavNodeComponent } from './sidebar-nav-node.component';
import { LayoutService } from '../../../core/services/layout/layout.service';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [SidebarNavNodeComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  layoutService = inject(LayoutService);
  authStore = inject(AuthStore);
}
