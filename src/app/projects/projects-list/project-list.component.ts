import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { ContractorService } from '../../services/contractor.service';
import { HttpClientModule } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { Project } from '../models/project.model';
import { Contractor, ContractorExpertise } from '../models/project.model';
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
  contractors: Contractor[] = [];
  contractorsLoading = false;
  contractorsError = '';

  constructor(
    private projectService: ProjectService,
    private contractorService: ContractorService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProjects();
    this.loadContractors();
    this.navigationSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        if (event.urlAfterRedirects.startsWith('/projects')) {
          this.loadProjects();
          this.loadContractors();
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

  private loadContractors(): void {
    this.contractorsLoading = true;
    this.contractorsError = '';

    this.contractorService.getAllContractors()
      .pipe(finalize(() => this.contractorsLoading = false))
      .subscribe({
        next: (contractors) => {
          this.contractors = contractors ?? [];
        },
        error: (err) => {
          console.error('Failed loading contractors', err);
          this.contractorsError = 'Unable to load contractors.';
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
    return this.getDerivedEtaDays(project);
  }

  private getDerivedEtaDays(project: Project): number | undefined {
    const baselineEta = project.eta;
    if (baselineEta === undefined || baselineEta === null || baselineEta <= 0) {
      return undefined;
    }

    const expertise = this.getContractorExpertise(project.contractor);
    const expertiseFactor = this.getExpertiseFactor(expertise);
    const workerFactor = this.getWorkerFactor(project.number_of_workers ?? project.numberOfWorkers ?? 0);
    const progressFactor = this.getProgressFactor(project.progress ?? 0);
    const etaWeeks = baselineEta * expertiseFactor * workerFactor * progressFactor;

    return Math.max(0, Math.round(etaWeeks * 7));
  }

  private getContractorExpertise(contractorId?: string): ContractorExpertise | undefined {
    if (!contractorId) {
      return undefined;
    }
    return this.contractors.find(c => c.id === contractorId)?.expertise;
  }

  private getExpertiseFactor(level?: ContractorExpertise): number {
    switch (level) {
      case 'SENIOR':
        return 0.75;
      case 'APPRENTICE':
        return 0.95;
      case 'JUNIOR':
        return 1.15;
      default:
        return 1;
    }
  }

  private getWorkerFactor(workers: number): number {
    if (!workers) {
      return 1.2;
    }
    const baseline = 12;
    const ratio = baseline / workers;

    return Math.min(1.35, Math.max(0.65, ratio));
  }

  private getProgressFactor(progress: number): number {
    const clamped = Math.min(100, Math.max(0, progress));
    const remaining = 1 - clamped / 100;
    return Math.max(0.05, remaining);
  }
}
