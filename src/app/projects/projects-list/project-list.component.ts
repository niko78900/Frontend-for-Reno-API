import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { HttpClientModule } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { Project } from '../models/project.model';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css']
})
export class ProjectListComponent implements OnInit, OnDestroy {

  projects: Project[] = [];
  loading = true;
  errorMessage = '';
  private navigationSub?: Subscription;

  constructor(
    private projectService: ProjectService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProjects();
    this.navigationSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        if (event.urlAfterRedirects.startsWith('/projects')) {
          this.loadProjects();
        }
      });
  }

  ngOnDestroy(): void {
    this.navigationSub?.unsubscribe();
  }

  goToDetails(project: Project) {
    const fallbackMongoId = (project as Project & { _id?: string })._id;
    const id = project?.id ?? fallbackMongoId;

    if (!id) {
      console.warn('Project is missing an id field, cannot navigate to details:', project);
      return;
    }

    this.router.navigate(['/projects', id], {
      state: { project }
    });
  }

  private loadProjects(): void {
    this.loading = true;
    this.errorMessage = '';

    this.projectService.getAllProjects()
      .pipe(finalize(() => {
        this.loading = false;
      }))
      .subscribe({
        next: (data) => {
          const normalizedProjects = this.normalizeProjectResponse(data);

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

  private normalizeProjectResponse(data: unknown): Project[] {
    if (Array.isArray(data)) {
      return data as Project[];
    }

    if (typeof data === 'object' && data !== null) {
      const { projects, data: innerData } = data as {
        projects?: unknown;
        data?: unknown;
      };

      if (Array.isArray(projects)) {
        return projects as Project[];
      }

      if (Array.isArray(innerData)) {
        return innerData as Project[];
      }
    }

    return [];
  }

  getEtaDays(project: Project): number | undefined {
    const baselineEta = project.eta;
    if (baselineEta === undefined || baselineEta === null || baselineEta <= 0) {
      return undefined;
    }

    // Simple conversion: 1 week = 7 days.
    return Math.max(0, Math.round(baselineEta * 7));
  }
}
