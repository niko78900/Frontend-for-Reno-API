import { Routes } from '@angular/router';
import { ProjectListComponent } from './projects/projects-list/project-list.component';
import { ProjectDetailsComponent } from './projects/project-details/project-details.component';

export const routes: Routes = [
    { path: '', redirectTo: 'projects', pathMatch: 'full' },
    { path: 'projects', component: ProjectListComponent },
    { path: 'projects/:id', component: ProjectDetailsComponent },
];
