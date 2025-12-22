import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { ContractorService } from '../../services/contractor.service';
import { HttpClientModule } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { Project, Contractor, ContractorExpertise } from '../models/project.model';
import { Subscription, filter } from 'rxjs';
import { calculateEtaDays } from '../utils/eta.util';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, HttpClientModule, RouterModule],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css']
})
export class ProjectListComponent implements OnInit, OnDestroy {

  projects: Project[] = [];
  loading = true;
  errorMessage = '';
  private navigationSub?: Subscription;
  contractors: Contractor[] = [];

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
    this.contractorService.getAllContractors()
      .subscribe({
        next: (contractors) => {
          this.contractors = contractors ?? [];
        },
        error: (err) => {
          console.error('Failed loading contractors:', err);
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
    const contractorId = project.contractor;
    const contractorName = project.contractorName;
    if (!contractorId && !contractorName) {
      return undefined;
    }
    const match = this.contractors.find(c =>
      c.id === contractorId || c._id === contractorId || (contractorName ? c.fullName === contractorName : false)
    );
    return match?.expertise;
  }

}
