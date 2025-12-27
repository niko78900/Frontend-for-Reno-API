import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ProjectService } from '../services/project.service';
import { Project } from '../projects/models/project.model';
import { ProjectsOverviewMapComponent } from '../projects/projects-map/projects-overview-map.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, ProjectsOverviewMapComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  private themeTimeout?: number;
  projects: Project[] = [];
  loadingProjects = false;
  projectError = '';
  missingLocationCount = 0;

  constructor(
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
    this.loadProjects();
  }

  get isDarkTheme(): boolean {
    return document.documentElement.dataset['theme'] === 'dark';
  }

  setTheme(theme: 'light' | 'dark'): void {
    const root = document.documentElement;
    if (root.dataset['theme'] === theme) {
      return;
    }
    root.classList.add('theme-transition');
    root.dataset['theme'] = theme;
    window.clearTimeout(this.themeTimeout);
    this.themeTimeout = window.setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 250);
  }

  refreshProjects(): void {
    this.loadProjects();
  }

  private loadProjects(): void {
    this.loadingProjects = true;
    this.projectError = '';

    this.projectService.getProjectsWithCoordinates()
      .pipe(finalize(() => this.loadingProjects = false))
      .subscribe({
        next: (projects) => {
          const list = Array.isArray(projects) ? projects : [];
          this.projects = list.filter((project) => this.hasCoordinates(project));
          this.missingLocationCount = Math.max(0, list.length - this.projects.length);
        },
        error: (err) => {
          console.error('Failed loading project locations', err);
          this.projectError = 'Unable to load project locations right now.';
        }
      });
  }

  private hasCoordinates(project: Project): boolean {
    return Number.isFinite(project?.latitude) && Number.isFinite(project?.longitude);
  }
}
