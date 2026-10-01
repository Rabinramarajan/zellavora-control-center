import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LayoutService } from '../../../core/services/layout.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { SidebarNavNodeComponent } from './sidebar-nav-node.component';

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
