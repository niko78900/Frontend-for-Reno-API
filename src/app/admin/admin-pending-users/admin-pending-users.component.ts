import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { AdminService, PendingUser } from '../../services/admin.service';
import { AppMessageService } from '../../services/app-message.service';

@Component({
  selector: 'app-admin-pending-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-pending-users.component.html',
  styleUrls: ['./admin-pending-users.component.css']
})
export class AdminPendingUsersComponent implements OnInit {
  pendingUsers: PendingUser[] = [];
  loading = false;
  errorMessage = '';
  approving: Record<string, boolean> = {};

  constructor(
    private adminService: AdminService,
    private messageService: AppMessageService
  ) {}

  ngOnInit(): void {
    this.loadPendingUsers();
  }

  refresh(): void {
    this.loadPendingUsers();
  }

  trackByUserId(_: number, user: PendingUser): string {
    return user.id;
  }

  approveUser(user: PendingUser): void {
    if (!user?.id || this.approving[user.id]) {
      return;
    }

    this.approving[user.id] = true;
    this.errorMessage = '';

    this.adminService.approveUser(user.id)
      .pipe(finalize(() => {
        delete this.approving[user.id];
      }))
      .subscribe({
        next: () => {
          this.pendingUsers = this.pendingUsers.filter((item) => item.id !== user.id);
          this.messageService.show(`Approved ${user.username}.`, 'success');
        },
        error: (err) => {
          console.error('Failed approving user', err);
          this.errorMessage = 'Unable to approve user. Please try again.';
        }
      });
  }

  private loadPendingUsers(): void {
    this.loading = true;
    this.errorMessage = '';

    this.adminService.getPendingUsers()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (users) => {
          this.pendingUsers = users ?? [];
        },
        error: (err) => {
          console.error('Failed loading pending users', err);
          this.errorMessage = 'Unable to load pending users.';
        }
      });
  }
}
