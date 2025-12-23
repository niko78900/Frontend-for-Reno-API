import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { Project, Task, TaskStatus, Contractor, ContractorExpertise } from '../models/project.model';
import { finalize } from 'rxjs/operators';
import { TaskService } from '../../services/task.service';
import { ContractorService } from '../../services/contractor.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { calculateEtaDays } from '../utils/eta.util';

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
  taskPanelOpen = false;
  taskSaving = false;
  taskActionError = '';
  taskStatusDraft: Record<string, TaskStatus> = {};
  taskStatusSaving: Record<string, boolean> = {};
  taskRemoving: Record<string, boolean> = {};
  projectFinished = false;
  finishProjectSaving = false;
  readonly taskStatuses: TaskStatus[] = ['NOT_STARTED', 'WORKING', 'FINISHED', 'CANCELED'];

  projectForm: FormGroup;
  taskForm: FormGroup;
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
    this.taskForm = this.fb.group({
      name: ['', [Validators.required]],
      status: ['NOT_STARTED', [Validators.required]]
    });

    this.contractorControl.valueChanges.subscribe((value) => {
      this.pendingContractorId = this.getContractorId(value) ?? null;
      this.updateEtaDaysDisplayFromState();
    });

    this.projectForm.get('progress')?.valueChanges.subscribe(() => {
      this.updateEtaDaysDisplayFromState();
    });
    this.projectForm.get('number_of_workers')?.valueChanges.subscribe(() => {
      this.updateEtaDaysDisplayFromState();
    });
    this.projectForm.get('eta')?.valueChanges.subscribe(() => {
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
          const nextDraft: Record<string, TaskStatus> = {};
          this.tasks.forEach(task => {
            nextDraft[task.id] = this.taskStatusDraft[task.id] ?? task.status;
          });
          this.taskStatusDraft = nextDraft;
          if ((this.project?.progress ?? 0) >= 100 && this.taskCompletionPercent >= 99) {
            this.projectFinished = true;
          }
          this.updateEtaDaysDisplayFromState();
        },
        error: (err) => {
          console.error('Failed loading tasks for project', err);
          this.tasksError = 'Unable to load tasks for this project.';
        }
      });
  }

  trackByTaskId(_: number, task: Task): string {
    return task.id;
  }

  openTaskPanel(): void {
    this.taskActionError = '';
    this.taskPanelOpen = true;
    this.taskForm.reset({ name: '', status: 'NOT_STARTED' });
  }

  closeTaskPanel(): void {
    this.taskPanelOpen = false;
    this.taskForm.reset({ name: '', status: 'NOT_STARTED' });
  }

  createTask(): void {
    const projectId = this.project?.id;
    if (!projectId) {
      return;
    }

    this.taskActionError = '';
    this.taskForm.markAllAsTouched();

    const name = String(this.taskForm.get('name')?.value ?? '').trim();
    if (!name) {
      this.taskActionError = 'Task name is required.';
      return;
    }

    const status = (this.taskForm.get('status')?.value ?? 'NOT_STARTED') as TaskStatus;

    this.taskSaving = true;
    this.projectService.addTask(projectId, { name, status })
      .pipe(finalize(() => this.taskSaving = false))
      .subscribe({
        next: (updatedProject) => {
          if (updatedProject) {
            this.project = updatedProject;
          }
          this.closeTaskPanel();
          this.loadTasks(projectId);
        },
        error: (err) => {
          console.error('Failed creating task', err);
          this.taskActionError = 'Unable to create task. Please try again.';
        }
      });
  }

  getTaskStatusDraft(task: Task): TaskStatus {
    return this.taskStatusDraft[task.id] ?? task.status;
  }

  setTaskStatusDraft(task: Task, value: string): void {
    this.taskStatusDraft[task.id] = value as TaskStatus;
  }

  updateTaskStatus(task: Task): void {
    if (!task.id) {
      return;
    }

    const nextStatus = this.taskStatusDraft[task.id] ?? task.status;
    if (nextStatus === task.status) {
      return;
    }

    this.taskActionError = '';
    this.taskStatusSaving[task.id] = true;

    const payload: Task = { ...task, status: nextStatus };
    this.taskService.updateTask(task.id, payload)
      .pipe(finalize(() => this.taskStatusSaving[task.id] = false))
      .subscribe({
        next: (updated) => {
          const index = this.tasks.findIndex(item => item.id === task.id);
          if (index >= 0) {
            this.tasks[index] = updated;
          }
          this.taskStatusDraft[task.id] = updated.status;
          this.updateEtaDaysDisplayFromState();
        },
        error: (err) => {
          console.error('Failed updating task status', err);
          this.taskActionError = 'Unable to update task status.';
        }
      });
  }

  confirmRemoveTask(task: Task): void {
    if (!this.project?.id || !task.id) {
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to remove "${task.name}"?`);
    if (!confirmed) {
      return;
    }

    this.taskActionError = '';
    this.taskRemoving[task.id] = true;
    this.projectService.removeTask(this.project.id, task.id)
      .pipe(finalize(() => this.taskRemoving[task.id] = false))
      .subscribe({
        next: () => {
          this.tasks = this.tasks.filter(item => item.id !== task.id);
          delete this.taskStatusDraft[task.id];
          this.updateEtaDaysDisplayFromState();
        },
        error: (err) => {
          console.error('Failed removing task', err);
          this.taskActionError = 'Unable to remove task.';
        }
      });
  }

  get taskCompletionPercent(): number {
    const total = this.tasks.length;
    if (!total) {
      return 0;
    }
    const finished = this.tasks.filter(task => task.status === 'FINISHED').length;
    return Math.min(100, Math.max(0, Math.round((finished / total) * 100)));
  }

  get canFinishProject(): boolean {
    return this.taskCompletionPercent >= 99 && !this.projectFinished;
  }

  finishProject(): void {
    const projectId = this.project?.id;
    if (!projectId || this.projectFinished || this.taskCompletionPercent < 99) {
      return;
    }

    const confirmed = window.confirm('Are you sure you want to finish this project?');
    if (!confirmed) {
      return;
    }

    this.finishProjectSaving = true;
    this.projectService.updateProjectProgress(projectId, 100)
      .pipe(finalize(() => this.finishProjectSaving = false))
      .subscribe({
        next: (updated) => {
          this.project = updated;
          this.projectFinished = true;
        },
        error: (err) => {
          console.error('Failed finishing project', err);
        }
      });
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
    const contractorId = this.pendingContractorId
      ?? this.getContractorId(this.contractorControl.value)
      ?? this.getProjectContractorId();
    const contractorName = this.getProjectContractorName();

    if (contractorId) {
      return this.contractors.find(c => c.id === contractorId || c._id === contractorId);
    }

    if (!contractorName) {
      return undefined;
    }

    return this.contractors.find(c => c.fullName === contractorName);
  }

  get computedEta(): number | undefined {
    const etaDays = this.calculateDerivedEtaDays();
    if (etaDays === undefined) {
      return undefined;
    }
    const etaWeeks = etaDays / 7;
    return Math.max(0, Math.ceil(etaWeeks));
  }

  get computedEtaDays(): number | undefined {
    return this.calculateDerivedEtaDays();
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

    const contractorId = this.getProjectContractorId() ?? '';
    this.contractorControl.setValue(contractorId, { emitEvent: false });
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
          this.updateEtaDaysDisplayFromState();
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

    const contractorId = this.pendingContractorId ?? this.getContractorId(this.contractorControl.value);

    if (!contractorId) {
      this.clearContractor();
      return;
    }

    const selected = this.contractors.find(c => c.id === contractorId || c._id === contractorId);
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
    return calculateEtaDays({
      baseEtaWeeks: this.getBaselineEta(),
      workers: this.workforceCount,
      progressPercent: this.taskCompletionPercent,
      expertise: this.getProjectContractorExpertise()
    });
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
    const projectContractorId = this.getProjectContractorId();
    const projectContractorName = this.getProjectContractorName();

    let resolvedId: string | null = projectContractorId ?? null;
    if (!resolvedId && projectContractorName) {
      const nameMatch = this.contractors.find(c => c.fullName === projectContractorName);
      resolvedId = nameMatch?.id ?? nameMatch?._id ?? null;
    }

    if (!resolvedId) {
      return;
    }

    const currentId = this.getContractorId(currentValue);
    const isCurrentString = typeof currentValue === 'string';
    if (!currentId || currentId !== resolvedId || !isCurrentString) {
      this.contractorControl.setValue(resolvedId, { emitEvent: false });
      this.pendingContractorId = null;
    }
  }

  private getProjectContractorExpertise(): ContractorExpertise | undefined {
    const contractorId = this.getProjectContractorId();
    const contractorName = this.getProjectContractorName();
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

  private getActiveContractorPrice(): number {
    const contractorId = this.pendingContractorId
      ?? this.getContractorId(this.contractorControl.value)
      ?? this.getProjectContractorId();
    const contractorName = this.getProjectContractorName();
    if (contractorId) {
      const match = this.contractors.find(c => c.id === contractorId || c._id === contractorId);
      return this.toNumber(match?.price);
    }

    if (!contractorName) {
      return 0;
    }
    const match = this.contractors.find(c => c.fullName === contractorName);
    return this.toNumber(match?.price);
  }

  private getProjectContractorId(): string | undefined {
    return this.getContractorId(this.project?.contractor as unknown);
  }

  private getProjectContractorName(): string | undefined {
    const fromField = this.project?.contractorName;
    const fromContractor = this.getContractorName(this.project?.contractor as unknown);
    return fromField ?? fromContractor;
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
