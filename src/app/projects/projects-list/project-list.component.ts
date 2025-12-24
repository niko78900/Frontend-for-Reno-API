import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { ContractorService } from '../../services/contractor.service';
import { HttpClientModule } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { Project, Contractor, ContractorExpertise } from '../models/project.model';
import { calculateEtaDays } from '../utils/eta.util';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, HttpClientModule, RouterModule],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css']
})
export class ProjectListComponent implements OnInit {

  projects: Project[] = [];
  loading = true;
  errorMessage = '';
  contractors: Contractor[] = [];
  contractorsError = '';

  constructor(
    private projectService: ProjectService,
    private contractorService: ContractorService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProjects();
    this.loadContractors();
  }

  refreshProjects(): void {
    this.loadProjects();
    this.loadContractors();
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
    this.contractorsError = '';
    this.contractorService.getAllContractors()
      .subscribe({
        next: (contractors) => {
          this.contractors = contractors ?? [];
        },
        error: (err) => {
          console.error('Failed loading contractors:', err);
          this.contractorsError = 'Unable to load contractors. Contractor names may be missing.';
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
    return calculateEtaDays({
      baseEtaWeeks: project.eta,
      workers: project.number_of_workers ?? project.numberOfWorkers ?? 0,
      progressPercent: project.progress ?? 0,
      expertise: this.getContractorExpertise(project)
    });
  }

  private getContractorExpertise(project: Project): ContractorExpertise | undefined {
    const contractorId = this.getContractorId(project.contractor as unknown);
    const contractorName = project.contractorName ?? this.getContractorName(project.contractor as unknown);
    if (!contractorId && !contractorName) {
      return undefined;
    }
    if (contractorId) {
      const matchById = this.contractors.find(c => c.id === contractorId || c._id === contractorId);
      if (matchById) {
        return matchById.expertise;
      }
    }
    if (!contractorName) {
      return undefined;
    }
    return this.contractors.find(c => c.fullName === contractorName)?.expertise;
  }

  private getContractorId(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return this.isLikelyObjectId(value) ? value : undefined;
    }
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    const candidate = value as { id?: string; _id?: string };
    return candidate.id ?? candidate._id;
  }

  private getContractorName(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return this.isLikelyObjectId(value) ? undefined : value;
    }
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    const candidate = value as { fullName?: string };
    return candidate.fullName;
  }

  private isLikelyObjectId(value: string): boolean {
    return /^[a-fA-F0-9]{24}$/.test(value.trim());
  }

}
