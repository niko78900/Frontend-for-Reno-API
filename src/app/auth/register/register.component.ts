import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { AppMessageService } from '../../services/app-message.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  readonly form: FormGroup;

  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private messageService: AppMessageService,
    private router: Router
  ) {
    this.form = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/projects']);
    }
  }

  submit(): void {
    if (this.loading) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const username = String(this.form.value.username ?? '').trim();
    const password = String(this.form.value.password ?? '');

    if (!username || !password) {
      this.errorMessage = 'Enter a username and password.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.register(username, password)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (response) => {
          if (response?.enabled === false) {
            this.router.navigate(['/pending']);
            return;
          }

          this.messageService.show('Account created. You can sign in now.', 'success');
          this.router.navigate(['/login']);
        },
        error: (err) => {
          if (err?.status === 409) {
            this.errorMessage = 'That username is already taken.';
            return;
          }
          this.errorMessage = 'Unable to register right now. Please try again.';
        }
      });
  }
}
