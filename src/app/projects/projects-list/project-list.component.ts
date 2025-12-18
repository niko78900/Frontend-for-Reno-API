import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { HttpClientModule } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css']
})
export class ProjectListComponent implements OnInit {

  projects: any[] = [];
  loading = true;
  errorMessage = '';

  constructor(
    private projectService: ProjectService,
    private router: Router
  ) {}

  ngOnInit(): void {
    console.log('ProjectListComponent initialized');
    this.loadProjects();
  }

  goToDetails(project: any) {
    const id = project?.id ?? project?._id;

    if (!id) {
      console.warn('Project is missing an id field, cannot navigate to details:', project);
      return;
    }

    this.router.navigate(['/projects', id]);
  }

  private loadProjects(): void {
    console.log('Loading projects...');
    this.loading = true;
    this.errorMessage = '';

    this.projectService.getAllProjects()
      .pipe(finalize(() => {
        console.log('Projects finalize called');
        this.loading = false;
      }))
      .subscribe({
        next: (data) => {
          console.log('projects response', data);
          const normalizedProjects = this.normalizeProjectResponse(data);
          console.log('normalized projects', normalizedProjects);

          if (!normalizedProjects.length) {
            console.warn('Projects response was empty or unexpected:', data);
          }

          this.projects = normalizedProjects;
        },
        error: (err) => {
          console.error('Failed loading projects:', err);
          this.errorMessage = 'Unable to load projects. Check the backend server or API URL.';
        }
      });
  }

  private normalizeProjectResponse(data: any): any[] {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.projects)) {
      return data.projects;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  }
}
