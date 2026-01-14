import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  readonly form: FormGroup;

  loading = false;
  errorMessage = '';
  pendingApproval = false;
  private returnUrl = '/projects';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/projects']);
      return;
    }

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) {
      this.returnUrl = returnUrl;
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
      this.errorMessage = 'Enter your username and password.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.pendingApproval = false;

    this.authService.login(username, password)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: () => {
          this.router.navigateByUrl(this.returnUrl);
        },
        error: (err) => {
          if (err?.status === 403) {
            this.pendingApproval = true;
            this.errorMessage = 'Account pending approval. Please check back soon.';
            return;
          }
          if (err?.status === 401) {
            this.errorMessage = 'Invalid username or password.';
            return;
          }
          this.errorMessage = 'Unable to sign in right now. Please try again.';
        }
      });
  }
}
