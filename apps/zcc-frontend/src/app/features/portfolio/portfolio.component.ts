import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { RouterLink, RouterOutlet } from '@angular/router';
import { PortfolioService } from './services/portfolio.service';

@Component({
  selector: 'app-portfolio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.css',
})
export class PortfolioComponent {
  portfolio = inject(PortfolioService);
}
