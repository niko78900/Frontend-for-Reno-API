import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { Project, Task, TaskStatus, Contractor, ContractorExpertise } from '../models/project.model';
import { of, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, map, switchMap } from 'rxjs/operators';
import { TaskService } from '../../services/task.service';
import { ContractorService } from '../../services/contractor.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { calculateEtaDays } from '../utils/eta.util';
import { GeocodingService } from '../../services/geocoding.service';
import { ProjectCoordinates, ProjectLocationMapComponent } from '../location-map/project-location-map.component';

type GeocodeRequest = {
  address: string;
  debounceMs: number;
};

@Component({
  selector: 'app-project-details',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ProjectLocationMapComponent],
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
  locationCoordinates: ProjectCoordinates | null = null;
  locationMessage = 'Add an address to place a marker.';
  locationError = '';
  geocodingAddress = false;
  locationSaving = false;
  locationPendingSave = false;
  private geocodeRequests = new Subject<GeocodeRequest>();
  private pendingContractorId: string | null = null;
  private baseEtaWeeks: number | null = null;
  settingsOpen = false;

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private taskService: TaskService,
    private contractorService: ContractorService,
    private geocodingService: GeocodingService,
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
      if (this.isLocked()) {
        this.ensureContractorSelection();
        return;
      }
      this.pendingContractorId = this.getContractorId(value) ?? null;
      this.updateEtaDaysDisplayFromState();
    });

    this.projectForm.get('progress')?.valueChanges.subscribe((value) => {
      if (this.isFieldLocked('progress')) {
        const clamped = this.clampProgress(this.project?.progress);
        this.projectForm.get('progress')?.setValue(clamped, { emitEvent: false });
        return;
      }
      this.updateEtaDaysDisplayFromState();
    });
    this.projectForm.get('number_of_workers')?.valueChanges.subscribe(() => {
      if (this.isFieldLocked('number_of_workers')) {
        this.resetLockedField('number_of_workers');
        return;
      }
      this.updateEtaDaysDisplayFromState();
    });
    this.projectForm.get('eta')?.valueChanges.subscribe(() => {
      if (this.isFieldLocked('eta')) {
        this.resetLockedField('eta');
        return;
      }
      this.updateEtaDaysDisplayFromState();
    });

      this.projectForm.get('address')?.valueChanges
        .pipe(distinctUntilChanged())
        .subscribe((value) => {
          if (this.isFieldLocked('address')) {
            this.resetLockedField('address');
            return;
          }
          const nextAddress = String(value ?? '').trim();
          const savedAddress = String(this.project?.address ?? '').trim();
          const addressChanged = nextAddress !== savedAddress;
          if (!nextAddress) {
            this.locationCoordinates = null;
            this.locationPendingSave = false;
            this.locationMessage = 'Add an address to place a marker.';
            this.locationError = '';
          } else if (addressChanged) {
            this.locationCoordinates = null;
            this.locationPendingSave = false;
            this.locationMessage = 'Looking up address...';
            this.locationError = '';
          }
          this.requestGeocode(nextAddress, 450);
        });

    this.projectForm.get('budget')?.valueChanges.subscribe(() => {
      if (this.isFieldLocked('budget')) {
        this.resetLockedField('budget');
      }
    });

    this.setupGeocodeStream();
  }

  ngOnInit() {
    this.loading = true;
    const id = this.route.snapshot.paramMap.get('id')?.trim();

    if (!id) {
      this.loading = false;
      this.errorMessage = 'Project id is missing from the route.';
      return;
    }

    const stateProject = window.history.state?.project as Project | undefined;
    const matchesStateId = stateProject && stateProject.id === id;

    if (matchesStateId) {
      this.project = stateProject;
      this.setProjectFinished(this.project);
      this.syncFormWithProject();
      this.setLocationFromProject(this.project);
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
          this.setProjectFinished(this.project);
          this.captureBaselineEta();
          this.syncFormWithProject();
          this.setLocationFromProject(this.project);
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
          this.setProjectFinished(this.project);
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
    if (this.isLocked()) {
      return;
    }
    this.taskActionError = '';
    this.taskPanelOpen = true;
    this.taskForm.reset({ name: '', status: 'NOT_STARTED' });
  }

  closeTaskPanel(): void {
    this.taskPanelOpen = false;
    this.taskForm.reset({ name: '', status: 'NOT_STARTED' });
  }

  createTask(): void {
    if (this.isLocked()) {
      return;
    }
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
            this.setProjectFinished(this.project);
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
    if (this.isLocked()) {
      return;
    }
    this.taskStatusDraft[task.id] = value as TaskStatus;
  }

  updateTaskStatus(task: Task): void {
    if (this.isLocked()) {
      return;
    }
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
    if (this.isLocked()) {
      return;
    }
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
    if (this.projectFinished) {
      return 100;
    }
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
    this.projectService.updateProjectFinished(projectId, true)
      .pipe(finalize(() => this.finishProjectSaving = false))
      .subscribe({
        next: (updated) => {
          const merged = { ...this.project, ...updated };
          if (merged.finished === undefined) {
            merged.finished = true;
          }
          if (merged.finished && (merged.progress ?? 0) < 100) {
            merged.progress = 100;
          }
          this.project = merged;
          this.setProjectFinished(this.project);
          this.syncFormWithProject();
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
      return this.contractors.find(c => c.id === contractorId);
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

    this.setProjectFinished(this.project);
    const clampedProgress = this.clampProgress(this.project.progress);
    const progressValue = this.projectFinished ? Math.max(clampedProgress, 100) : clampedProgress;
    this.captureBaselineEta();
    const baselineEta = this.getBaselineEta();

    this.projectForm.patchValue({
      name: this.project.name ?? '',
      address: this.project.address ?? '',
      budget: this.project.budget ?? 0,
      number_of_workers: this.workforceCount,
      progress: progressValue,
      eta: baselineEta ?? 0,
    });

    // Keep local project progress aligned with the capped slider to avoid jumping back to 100.
    this.project.progress = progressValue;
    this.setProjectFinished(this.project);

    const contractorId = this.getProjectContractorId() ?? '';
    this.contractorControl.setValue(contractorId, { emitEvent: false });
    this.ensureContractorSelection();
    this.updateEtaDaysDisplayFromState();
    this.setLocationFromProject(this.project);
  }

  updateField(field: 'name' | 'address' | 'budget' | 'number_of_workers' | 'progress' | 'eta'): void {
    if (this.isFieldLocked(field)) {
      return;
    }
    if (!this.project?.id) {
      return;
    }

    const value = this.projectForm.get(field)?.value;
    let request$;
    let shouldClearCoordinates = false;
    let includeCoordinates = false;

    switch (field) {
      case 'name':
        request$ = this.projectService.updateProjectName(this.project.id, value);
        break;
      case 'address': {
        const trimmedAddress = String(value ?? '').trim();
        const savedAddress = String(this.project?.address ?? '').trim();
        const addressChanged = trimmedAddress !== savedAddress;
        const locationPayload = this.getPendingCoordinates();
        includeCoordinates = Boolean(locationPayload) && trimmedAddress.length > 0;
        shouldClearCoordinates = trimmedAddress.length === 0 || (addressChanged && !includeCoordinates);
        request$ = this.projectService.updateProjectAddress(
          this.project.id,
          trimmedAddress,
          includeCoordinates ? locationPayload ?? undefined : undefined
        );
        break;
      }
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
          if (field === 'address' && shouldClearCoordinates) {
            updated = { ...updated, latitude: undefined, longitude: undefined };
            this.locationCoordinates = null;
            this.locationPendingSave = false;
          } else if (field === 'address' && includeCoordinates) {
            this.locationPendingSave = false;
          }

          this.project = updated;
          if (updated.eta !== undefined && updated.eta !== null) {
            this.baseEtaWeeks = updated.eta;
          }
          this.laborError = '';
          this.syncFormWithProject();
          this.setLocationFromProject(updated);
        },
        error: (err) => {
          console.error(`Failed updating ${field}`, err);
        }
      });
  }

  onLocationChanged(coords: ProjectCoordinates): void {
    const address = String(this.projectForm.get('address')?.value ?? '').trim();
    if (!address) {
      this.locationCoordinates = null;
      this.locationPendingSave = false;
      this.locationMessage = 'Add an address to place a marker.';
      this.locationError = '';
      return;
    }
    this.locationCoordinates = coords;
    this.locationPendingSave = true;
    this.locationMessage = 'Marker updated. Save to store the coordinates.';
    this.locationError = '';
  }

  refreshLocationFromAddress(): void {
    const address = String(this.projectForm.get('address')?.value ?? '').trim() || this.project?.address || '';
    if (!address) {
      this.locationError = 'Enter an address first to place the marker.';
      return;
    }
    this.requestGeocode(address);
  }

  saveLocation(): void {
    if (!this.project?.id || !this.locationCoordinates) {
      return;
    }
    const address = String(this.projectForm.get('address')?.value ?? '').trim() || this.project?.address || '';
    if (!address) {
      this.locationError = 'Enter an address before saving coordinates.';
      return;
    }

    this.locationSaving = true;
    this.locationError = '';
    this.projectService.updateProjectAddress(
      this.project.id,
      address,
      this.locationCoordinates ?? undefined
    )
      .pipe(finalize(() => this.locationSaving = false))
      .subscribe({
        next: (updated) => {
          this.project = updated;
          this.locationPendingSave = false;
          this.setLocationFromProject(updated);
        },
        error: (err) => {
          console.error('Failed saving location', err);
          this.locationError = 'Unable to save location. Please try again.';
        }
      });
  }

  private requestGeocode(address: string, debounceMs = 0): void {
    this.geocodeRequests.next({ address, debounceMs });
  }

  private setupGeocodeStream(): void {
    this.geocodeRequests
      .pipe(
        switchMap(({ address, debounceMs }) => {
          const trimmedAddress = String(address ?? '').trim();
          if (!trimmedAddress) {
            this.geocodingAddress = false;
            return of({ address: trimmedAddress, result: null, skipped: true });
          }
          return of(trimmedAddress).pipe(
            debounceTime(debounceMs),
            switchMap((debouncedAddress) => {
              this.geocodingAddress = true;
              this.locationError = '';
              return this.geocodingService.geocodeAddress(debouncedAddress).pipe(
                map((result) => ({ address: debouncedAddress, result, skipped: false })),
                finalize(() => {
                  this.geocodingAddress = false;
                })
              );
            })
          );
        })
      )
      .subscribe(({ result, skipped }) => {
        if (skipped) {
          return;
        }
        if (!result) {
          this.locationError = 'We could not locate that address. Drag the marker into place.';
          return;
        }
        this.locationCoordinates = {
          latitude: result.latitude,
          longitude: result.longitude
        };
        this.locationPendingSave = true;
        this.locationMessage = 'Marker placed from the address. Save to confirm coordinates.';
      });
  }

  private setLocationFromProject(project?: Project): void {
    const address = String(project?.address ?? '').trim();
    if (!address) {
      this.locationCoordinates = null;
      this.locationMessage = 'Add an address to place a marker for this project.';
      this.locationError = '';
      this.locationPendingSave = false;
      return;
    }

    const coords = this.extractProjectCoordinates(project);
    if (coords && !this.locationPendingSave) {
      this.locationCoordinates = coords;
      this.locationMessage = 'Drag the marker to adjust the project location.';
      this.locationError = '';
      this.locationPendingSave = false;
    } else if (!coords && !this.locationPendingSave) {
      this.locationCoordinates = null;
      this.locationMessage = 'Add an address to place a marker for this project.';
      this.locationPendingSave = false;
      if (address && !this.geocodingAddress) {
        this.requestGeocode(address);
      }
    }
  }

  private extractProjectCoordinates(project?: Project): ProjectCoordinates | null {
    if (this.hasProjectCoordinates(project)) {
      return { latitude: project!.latitude as number, longitude: project!.longitude as number };
    }
    return null;
  }

  private getPendingCoordinates(): ProjectCoordinates | null {
    if (this.locationPendingSave && this.locationCoordinates && this.hasProjectCoordinates(this.locationCoordinates)) {
      return this.locationCoordinates;
    }
    return null;
  }

  private hasProjectCoordinates(project?: { latitude?: number; longitude?: number } | null): project is { latitude: number; longitude: number } {
    return Number.isFinite(project?.latitude) && Number.isFinite(project?.longitude);
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
    if (this.isLocked()) {
      return;
    }
    if (!this.project?.id) {
      return;
    }

    const contractorId = this.pendingContractorId ?? this.getContractorId(this.contractorControl.value);

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
    if (this.isLocked()) {
      return;
    }
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
    if (this.projectFinished) {
      return undefined;
    }
    const progressPercent = this.getEtaProgressPercent();
    return calculateEtaDays({
      baseEtaWeeks: this.getBaselineEta(),
      workers: this.workforceCount,
      progressPercent,
      expertise: this.getProjectContractorExpertise()
    });
  }

  private getEtaProgressPercent(): number {
    const projectProgress = this.clampProgress(this.project?.progress);
    return Math.max(projectProgress, this.taskCompletionPercent);
  }

  private clampProgress(value: unknown): number {
    const num = Number(value ?? 0);
    if (Number.isNaN(num) || num < 0) {
      return 0;
    }
    return Math.min(100, num);
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
      resolvedId = nameMatch?.id ?? null;
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
      const matchById = this.contractors.find(c => c.id === contractorId);
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
      const match = this.contractors.find(c => c.id === contractorId);
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
    const candidate = value as { id?: string };
    return candidate.id;
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

  isLocked(): boolean {
    return this.projectFinished;
  }

  isFieldLocked(field: 'name' | 'address' | 'budget' | 'number_of_workers' | 'progress' | 'eta'): boolean {
    if (!this.projectFinished) {
      return false;
    }
    return field !== 'name';
  }

  private resetLockedField(field: 'address' | 'budget' | 'number_of_workers' | 'progress' | 'eta'): void {
    if (!this.project) {
      return;
    }
    const control = this.projectForm.get(field);
    if (!control) {
      return;
    }

    let value: unknown;
    switch (field) {
      case 'address':
        value = this.project.address ?? '';
        break;
      case 'budget':
        value = this.project.budget ?? 0;
        break;
      case 'number_of_workers':
        value = this.workforceCount;
        break;
      case 'progress':
        value = this.clampProgress(this.project.progress);
        break;
      case 'eta':
        value = this.getBaselineEta() ?? 0;
        break;
    }

    control.setValue(value, { emitEvent: false });
  }

  private setProjectFinished(project?: Project): void {
    const finishedFlag = project?.finished === true || (project?.progress ?? 0) >= 100;
    this.projectFinished = finishedFlag;
    if (finishedFlag && project) {
      project.progress = Math.max(project.progress ?? 0, 100);
    }
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
