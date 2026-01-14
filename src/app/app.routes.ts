import { Routes } from '@angular/router';
import { ProjectListComponent } from './projects/projects-list/project-list.component';
import { ProjectDetailsComponent } from './projects/project-details/project-details.component';
import { HomeComponent } from './home/home.component';
import { ProjectCreateComponent } from './projects/project-create/project-create.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { PendingApprovalComponent } from './auth/pending-approval/pending-approval.component';
import { AdminPendingUsersComponent } from './admin/admin-pending-users/admin-pending-users.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
    { path: '', component: HomeComponent, canActivate: [authGuard] },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: 'pending', component: PendingApprovalComponent },
    { path: 'projects', component: ProjectListComponent, canActivate: [authGuard] },
    { path: 'projects/new', component: ProjectCreateComponent, canActivate: [authGuard] },
    { path: 'projects/:id', component: ProjectDetailsComponent, canActivate: [authGuard] },
    { path: 'admin/users', component: AdminPendingUsersComponent, canActivate: [adminGuard] },
];
