import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { Project, Task, Contractor } from '../models/project.model';
import { finalize } from 'rxjs/operators';
import { TaskService } from '../../services/task.service';
import { ContractorService } from '../../services/contractor.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl } from '@angular/forms';

@Component({
  selector: 'app-project-details',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './project-details.component.html',
  styleUrls: ['./project-details.component.css']
})
export class ProjectDetailsComponent implements OnInit {

  project?: Project;
  loading = true;
  errorMessage = '';
  tasks: Task[] = [];
  tasksLoading = false;
  tasksError = '';
  activeTask?: Task;

  projectForm: FormGroup;
  contractorControl = new FormControl('');
  fieldSaving = {
    name: false,
    address: false,
    budget: false,
    number_of_workers: false,
    progress: false,
    eta: false,
  };
  contractors: Contractor[] = [];
  contractorsLoading = false;
  contractorsError = '';
  contractorSaving = false;
  laborError = '';
  etaDaysDisplay?: number;
  private pendingContractorId: string | null = null;
  private baseEtaWeeks: number | null = null;
  settingsOpen = false;

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private taskService: TaskService,
    private contractorService: ContractorService,
    private fb: FormBuilder
  ) {
    this.projectForm = this.fb.group({
      name: [''],
      address: [''],
      budget: [0],
      number_of_workers: [0],
      progress: [0],
      eta: [0],
    });

    this.contractorControl.valueChanges.subscribe((value) => {
      this.pendingContractorId = value || null;
      this.updateEtaDaysDisplayFromState();
    });
  }

  ngOnInit() {
    this.loading = true;
    const id = this.route.snapshot.paramMap.get('id')?.trim();

    if (!id) {
      this.loading = false;
      this.errorMessage = 'Project id is missing from the route.';
      return;
    }

    const stateProject = window.history.state?.project as (Project & { _id?: string }) | undefined;
    const matchesStateId = stateProject && ((stateProject.id ?? stateProject._id) === id);

    if (matchesStateId) {
      this.project = stateProject;
      this.syncFormWithProject();
      this.loadTasks(id);
      this.loadContractors();
    }

    this.fetchProject(id);
  }

  openSettings(): void {
    this.settingsOpen = true;
    if (!this.contractors.length && (this.project?.contractor || this.project?.contractorName)) {
      this.loadContractors();
    }
    this.ensureContractorSelection();
  }

  closeSettings(): void {
    this.settingsOpen = false;
  }

  private fetchProject(id: string): void {
    if (!this.project) {
      this.loading = true;
    }
    this.errorMessage = '';

    this.projectService.getProjectById(id)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (data) => {
          this.project = data;
          this.captureBaselineEta();
          this.syncFormWithProject();
          this.contractorControl.setValue(this.project?.contractor ?? '');
          this.ensureContractorSelection();
          this.loadTasks(id);
          this.loadContractors();
        },
        error: (err) => {
          console.error('Failed loading project details', err);
          this.errorMessage = err?.status === 404
            ? 'Project not found. It may have been deleted.'
            : 'Unable to load project details. Please try again.';
        }
      });
  }

  private loadTasks(projectId: string): void {
    this.tasksLoading = true;
    this.tasksError = '';

    this.taskService.getTasksByProject(projectId)
      .pipe(finalize(() => this.tasksLoading = false))
      .subscribe({
        next: (tasks) => {
          this.tasks = tasks ?? [];
          if (!this.activeTask && this.tasks.length) {
            this.activeTask = this.tasks[0];
          } else if (this.activeTask) {
            const refreshed = this.tasks.find(t => t.id === this.activeTask?.id);
            this.activeTask = refreshed ?? this.activeTask;
          }
        },
        error: (err) => {
          console.error('Failed loading tasks for project', err);
          this.tasksError = 'Unable to load tasks for this project.';
        }
      });
  }

  selectTask(task: Task): void {
    this.activeTask = task;
  }

  trackByTaskId(_: number, task: Task): string {
    return task.id;
  }

  get workforceCount(): number {
    if (!this.project) {
      return 0;
    }
    return this.project.number_of_workers
      ?? this.project.numberOfWorkers
      ?? 0;
  }

  get currentContractor(): Contractor | undefined {
    const contractorId = this.pendingContractorId ?? this.project?.contractor;

    if (!contractorId) {
      return undefined;
    }

    return this.contractors.find(c => c.id === contractorId);
  }

  get computedEta(): number | undefined {
    const baselineEta = this.getBaselineEta();
    if (baselineEta === undefined) {
      return undefined;
    }

    // Simple weeks value; factors removed so 1 week = 7 days consistently.
    return Math.max(0, Math.round(baselineEta * 10) / 10);
  }

  get computedEtaDays(): number | undefined {
    const etaWeeks = this.getBaselineEta();
    if (etaWeeks === undefined) {
      return undefined;
    }
    return Math.max(0, Math.round(etaWeeks * 7));
  }

  private syncFormWithProject(): void {
    if (!this.project) {
      return;
    }

    const clampedProgress = this.clampProgress(this.project.progress);
    this.captureBaselineEta();
    const baselineEta = this.getBaselineEta();

    this.projectForm.patchValue({
      name: this.project.name ?? '',
      address: this.project.address ?? '',
      budget: this.project.budget ?? 0,
      number_of_workers: this.workforceCount,
      progress: clampedProgress,
      eta: baselineEta ?? 0,
    });

    // Keep local project progress aligned with the capped slider to avoid jumping back to 100.
    this.project.progress = clampedProgress;

    this.contractorControl.setValue(this.project.contractor ?? '', { emitEvent: false });
    this.ensureContractorSelection();
    this.updateEtaDaysDisplayFromState();
  }

  updateField(field: 'name' | 'address' | 'budget' | 'number_of_workers' | 'progress' | 'eta'): void {
    if (!this.project?.id) {
      return;
    }

    const value = this.projectForm.get(field)?.value;
    let request$;

    switch (field) {
      case 'name':
        request$ = this.projectService.updateProjectName(this.project.id, value);
        break;
      case 'address':
        request$ = this.projectService.updateProjectAddress(this.project.id, value);
        break;
      case 'budget':
        const clampedBudget = this.clampNonNegative(value, false);
        this.projectForm.get('budget')?.setValue(clampedBudget, { emitEvent: false });
        const activeContractorPriceForBudget = this.getActiveContractorPrice();
        if (this.violatesLaborBudget(this.workforceCount, activeContractorPriceForBudget, clampedBudget)) {
          this.laborError = this.laborBudgetMessage(this.workforceCount, activeContractorPriceForBudget, clampedBudget);
          this.projectForm.get('budget')?.setValue(this.project.budget ?? 0, { emitEvent: false });
          return;
        }
        request$ = this.projectService.updateProjectBudget(this.project.id, clampedBudget);
        break;
      case 'progress':
        const clampedProgress = this.clampProgress(value);
        this.projectForm.get('progress')?.setValue(clampedProgress, { emitEvent: false });
        request$ = this.projectService.updateProjectProgress(this.project.id, clampedProgress);
        break;
      case 'number_of_workers':
        const clampedWorkers = this.clampNonNegative(value, true);
        this.projectForm.get('number_of_workers')?.setValue(clampedWorkers, { emitEvent: false });
        const activeContractorPrice = this.getActiveContractorPrice();
        if (this.violatesLaborBudget(clampedWorkers, activeContractorPrice, this.project?.budget)) {
          this.laborError = this.laborBudgetMessage(clampedWorkers, activeContractorPrice, this.project?.budget);
          return;
        }
        request$ = this.projectService.updateProjectWorkers(this.project.id, clampedWorkers);
        break;
      case 'eta':
        const etaValue = this.clampNonNegative(value, true);
        this.projectForm.get('eta')?.setValue(etaValue, { emitEvent: false });
        request$ = this.projectService.updateProjectEta(this.project.id, etaValue);
        break;
      default:
        return;
    }

    this.fieldSaving[field] = true;

    request$
      .pipe(finalize(() => this.fieldSaving[field] = false))
      .subscribe({
        next: (updated) => {
          this.project = updated;
          if (updated.eta !== undefined && updated.eta !== null) {
            this.baseEtaWeeks = updated.eta;
          }
          this.laborError = '';
          this.syncFormWithProject();
        },
        error: (err) => {
          console.error(`Failed updating ${field}`, err);
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
          this.ensureContractorSelection();
        },
        error: (err) => {
          console.error('Failed loading contractors', err);
          this.contractorsError = 'Unable to load contractors.';
        }
      });
  }

  applyContractor(): void {
    if (!this.project?.id) {
      return;
    }

    const contractorId = this.contractorControl.value;

    if (!contractorId) {
      this.clearContractor();
      return;
    }

    const selected = this.contractors.find(c => c.id === contractorId);
    const contractorPrice = this.toNumber(selected?.price);
    if (this.violatesLaborBudget(this.workforceCount, contractorPrice, this.project?.budget)) {
      this.laborError = this.laborBudgetMessage(this.workforceCount, contractorPrice, this.project?.budget);
      return;
    }

    this.contractorSaving = true;
    this.projectService.assignProjectContractor(this.project.id, contractorId)
      .pipe(finalize(() => this.contractorSaving = false))
      .subscribe({
        next: (updated) => {
          this.project = updated;
          this.pendingContractorId = null;
          this.laborError = '';
          this.syncFormWithProject();
        },
        error: (err) => {
          console.error('Failed assigning contractor', err);
        }
      });
  }

  clearContractor(): void {
    if (!this.project?.id) {
      return;
    }
    this.contractorSaving = true;
    this.projectService.removeProjectContractor(this.project.id)
      .pipe(finalize(() => this.contractorSaving = false))
      .subscribe({
        next: (updated) => {
          this.project = updated;
          this.pendingContractorId = null;
          this.contractorControl.setValue('');
          this.syncFormWithProject();
        },
        error: (err) => {
          console.error('Failed removing contractor', err);
        }
      });
  }

  formatStatus(status?: Task['status']): string {
    if (!status) {
      return 'Unknown';
    }

    return status
      .toLowerCase()
      .split('_')
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private updateEtaDaysDisplayFromState(): void {
    this.etaDaysDisplay = this.calculateDerivedEtaDays();
  }

  private calculateDerivedEtaDays(): number | undefined {
    const etaWeeks = this.getBaselineEta();
    if (etaWeeks === undefined) {
      return undefined;
    }

    // Simple conversion: 1 week = 7 days.
    return Math.max(0, Math.round(etaWeeks * 7));
  }

  private clampProgress(value: unknown): number {
    const num = Number(value ?? 0);
    if (Number.isNaN(num) || num < 0) {
      return 0;
    }
    return Math.min(99, num);
  }

  private clampNonNegative(value: unknown, asInteger: boolean): number {
    const num = Number(value ?? 0);
    if (Number.isNaN(num) || num < 0) {
      return 0;
    }
    return asInteger ? Math.round(num) : num;
  }

  private ensureContractorSelection(): void {
    if (!this.project) {
      return;
    }

    const currentValue = this.contractorControl.value;
    const projectContractorId = this.project.contractor;
    const projectContractorName = this.project.contractorName;

    let resolvedId: string | null = projectContractorId ?? null;
    if (!resolvedId && projectContractorName) {
      const nameMatch = this.contractors.find(c => c.fullName === projectContractorName);
      resolvedId = nameMatch?.id ?? nameMatch?._id ?? null;
    }

    if (!resolvedId) {
      return;
    }

    const currentMatches = this.contractors.some(c =>
      c.id === currentValue || c._id === currentValue
    );

    if (!currentMatches) {
      this.contractorControl.setValue(resolvedId, { emitEvent: false });
      this.pendingContractorId = null;
    }
  }

  private getActiveContractorPrice(): number {
    const contractorId = this.pendingContractorId ?? this.contractorControl.value ?? this.project?.contractor;
    const contractorName = this.project?.contractorName;
    if (!contractorId && !contractorName) {
      return 0;
    }
    const match = this.contractors.find(c =>
      c.id === contractorId || c._id === contractorId || (contractorName ? c.fullName === contractorName : false)
    );
    return this.toNumber(match?.price);
  }

  private toNumber(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private violatesLaborBudget(workers: number, contractorPrice: number, budget?: number): boolean {
    if (budget === undefined || budget === null) {
      return false;
    }
    const laborCap = budget * 0.5;
    const totalLabor = workers + contractorPrice;
    return totalLabor > laborCap;
  }

  private laborBudgetMessage(workers: number, contractorPrice: number, budget?: number): string {
    if (budget === undefined || budget === null) {
      return '';
    }
    const laborCap = Math.max(0, Math.round(budget * 0.5));
    const totalLabor = workers + contractorPrice;
    return `Labor cap exceeded: workers (${workers}) + contractor (${contractorPrice}) = ${totalLabor}, cap is ${laborCap} (50% of budget).`;
  }

  private getBaselineEta(): number | undefined {
    const eta = this.baseEtaWeeks ?? this.project?.eta;
    if (eta === undefined || eta === null || eta <= 0) {
      return undefined;
    }
    return eta;
  }

  private captureBaselineEta(): void {
    if (this.baseEtaWeeks !== null) {
      return;
    }
    const eta = this.project?.eta;
    if (eta !== undefined && eta !== null && eta > 0) {
      this.baseEtaWeeks = eta;
    }
  }

}
