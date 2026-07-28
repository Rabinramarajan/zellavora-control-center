import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminStoreService } from '../../../services';
import { User } from '../../../models';

@Component({
  selector: 'zcc-user-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.css'
})
export class UserDetailComponent implements OnInit {
  private store = inject(AdminStoreService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly isNew = signal(true);

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id === 'new') {
      const newUser = await this.store.createUser();
      this.user.set(newUser);
      this.isNew.set(true);
    } else if (id) {
      const user = await this.store.openUser(parseInt(id));
      this.user.set(user);
      this.isNew.set(false);
    }
  }

  async onSave(): Promise<void> {
    if (!this.user()) return;
    try {
      await this.store.saveUser(this.user()!);
      this.router.navigate(['/admin/users']);
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  }
}
