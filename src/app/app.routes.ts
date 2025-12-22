import { Routes } from '@angular/router';
import { ProjectListComponent } from './projects/projects-list/project-list.component';
import { ProjectDetailsComponent } from './projects/project-details/project-details.component';
import { HomeComponent } from './home/home.component';
import { ProjectCreateComponent } from './projects/project-create/project-create.component';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'projects', component: ProjectListComponent },
    { path: 'projects/new', component: ProjectCreateComponent },
    { path: 'projects/:id', component: ProjectDetailsComponent },
];
