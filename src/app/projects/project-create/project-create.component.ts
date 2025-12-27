import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, map, switchMap } from 'rxjs/operators';
import { ContractorService } from '../../services/contractor.service';
import { ProjectService } from '../../services/project.service';
import { Contractor, Project } from '../models/project.model';
import { GeocodingService } from '../../services/geocoding.service';
import { ProjectCoordinates, ProjectLocationMapComponent } from '../location-map/project-location-map.component';

@Component({
  selector: 'app-project-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ProjectLocationMapComponent],
  templateUrl: './project-create.component.html',
  styleUrls: ['./project-create.component.css']
})
export class ProjectCreateComponent implements OnInit {
  projectForm: FormGroup;
  contractors: Contractor[] = [];
  contractorsLoading = false;
  contractorsError = '';
  saving = false;
  errorMessage = '';
  laborError = '';
  workersNotice = '';
  autoWorkers = 0;
  locationCoordinates: ProjectCoordinates | null = null;
  geocodingAddress = false;
  locationError = '';
  locationMessage = 'Add an address to drop a marker on the map.';

  constructor(
    private fb: FormBuilder,
    private projectService: ProjectService,
    private contractorService: ContractorService,
    private geocodingService: GeocodingService,
    private router: Router
  ) {
    this.projectForm = this.fb.group({
      name: ['', [Validators.required]],
      address: [''],
      budget: [0, [Validators.required, Validators.min(1)]],
      eta: [0, [Validators.required, Validators.min(0)]],
      contractor: ['']
    });
  }

  ngOnInit(): void {
    this.loadContractors();
    this.updateAutoWorkers(this.projectForm.get('budget')?.value ?? 0);
    this.setupAddressWatcher();

    this.projectForm.get('budget')?.valueChanges.subscribe((value) => {
      const clampedBudget = this.clampNonNegative(value, false);
      if (clampedBudget !== value) {
        this.projectForm.get('budget')?.setValue(clampedBudget, { emitEvent: false });
      }
      this.updateAutoWorkers(clampedBudget);
      this.validateLaborCap();
    });

    this.projectForm.get('contractor')?.valueChanges.subscribe(() => {
      this.validateLaborCap();
    });
  }

  private setupAddressWatcher(): void {
    this.projectForm.get('address')?.valueChanges
      .pipe(
        map((value) => String(value ?? '').trim()),
        distinctUntilChanged(),
        switchMap((address) => {
          if (!address) {
            this.locationCoordinates = null;
            this.locationMessage = 'Add an address to drop a marker on the map.';
            this.locationError = '';
            this.geocodingAddress = false;
            return of({ address, result: null, skipped: true });
          }
          this.locationCoordinates = null;
          this.locationMessage = 'Finding address...';
          this.locationError = '';
          return of(address).pipe(
            debounceTime(450),
            switchMap((debouncedAddress) => this.geocodeAddress(debouncedAddress).pipe(
              map((result) => ({ address: debouncedAddress, result, skipped: false }))
            ))
          );
        })
      )
      .subscribe(({ result, skipped }) => {
        if (skipped) {
          return;
        }
        if (!result) {
          this.locationError = 'We could not locate that address. Drop the marker on the map manually.';
          return;
        }
        this.locationCoordinates = {
          latitude: result.latitude,
          longitude: result.longitude
        };
        this.locationMessage = 'Marker placed from the address. Drag to refine the exact spot.';
      });
  }

  private geocodeAddress(address: string) {
    this.geocodingAddress = true;
    this.locationError = '';
    return this.geocodingService.geocodeAddress(address)
      .pipe(finalize(() => {
        this.geocodingAddress = false;
      }));
  }

  onCoordinatesChange(coords: ProjectCoordinates): void {
    const address = String(this.projectForm.get('address')?.value ?? '').trim();
    if (!address) {
      this.locationCoordinates = null;
      this.locationMessage = 'Add an address to drop a marker on the map.';
      this.locationError = '';
      return;
    }
    this.locationCoordinates = coords;
    this.locationMessage = 'Marker updated. The address text stays as you entered it.';
    this.locationError = '';
  }

  showWorkersNotice(): void {
    this.workersNotice = 'Workers are auto-assigned from budget. You can edit this after the project is completed.';
  }

  createProject(): void {
    this.errorMessage = '';
    this.laborError = '';
    this.projectForm.markAllAsTouched();

    if (this.projectForm.invalid) {
      this.errorMessage = 'Please fill out the required fields before creating a project.';
      return;
    }

    const budget = this.clampNonNegative(this.projectForm.get('budget')?.value, false);
    if (budget <= 0) {
      this.errorMessage = 'Budget must be greater than 0.';
      return;
    }

    const contractorId = this.projectForm.get('contractor')?.value || undefined;
    const contractorPrice = this.getContractorPrice(contractorId);
    if (this.violatesLaborBudget(this.autoWorkers, contractorPrice, budget)) {
      this.laborError = this.laborBudgetMessage(this.autoWorkers, contractorPrice, budget);
      return;
    }

    const payload: Partial<Project> = {
      name: String(this.projectForm.get('name')?.value ?? '').trim(),
      address: String(this.projectForm.get('address')?.value ?? '').trim() || undefined,
      budget,
      contractor: contractorId,
      progress: 0,
      eta: this.clampNonNegative(this.projectForm.get('eta')?.value, true),
      number_of_workers: this.autoWorkers,
      latitude: this.locationCoordinates?.latitude,
      longitude: this.locationCoordinates?.longitude,
      taskIds: []
    };

    this.saving = true;
    this.projectService.createProject(payload)
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: (created) => {
          const id = created.id;
          if (id) {
            this.router.navigate(['/projects', id], { state: { project: created } });
          } else {
            this.router.navigate(['/projects']);
          }
        },
        error: (err) => {
          console.error('Failed creating project', err);
          this.errorMessage = 'Unable to create project. Please try again.';
        }
      });
  }

  isContractorOverBudget(contractor: Contractor): boolean {
    const budget = this.clampNonNegative(this.projectForm.get('budget')?.value, false);
    if (!budget) {
      return false;
    }
    const price = this.toNumber(contractor.price);
    return this.violatesLaborBudget(this.autoWorkers, price, budget);
  }

  private updateAutoWorkers(budget: number): void {
    this.autoWorkers = this.computeWorkers(budget);
  }

  private computeWorkers(budget: number): number {
    const normalized = this.toNumber(budget);
    if (normalized <= 0) {
      return 0;
    }
    const laborBudget = normalized / 2;
    const workers = Math.floor(laborBudget / 1500);
    return Math.max(1, workers);
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

  private validateLaborCap(): void {
    this.laborError = '';
    const budget = this.clampNonNegative(this.projectForm.get('budget')?.value, false);
    if (!budget) {
      return;
    }
    const contractorId = this.projectForm.get('contractor')?.value || undefined;
    const contractorPrice = this.getContractorPrice(contractorId);
    if (this.violatesLaborBudget(this.autoWorkers, contractorPrice, budget)) {
      this.laborError = this.laborBudgetMessage(this.autoWorkers, contractorPrice, budget);
    }
  }

  private getContractorPrice(contractorId?: string): number {
    if (!contractorId) {
      return 0;
    }
    const match = this.contractors.find(c => c.id === contractorId);
    return this.toNumber(match?.price);
  }

  private clampNonNegative(value: unknown, asInteger: boolean): number {
    const num = Number(value ?? 0);
    if (Number.isNaN(num) || num < 0) {
      return 0;
    }
    return asInteger ? Math.round(num) : num;
  }

  private toNumber(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private violatesLaborBudget(workers: number, contractorPrice: number, budget: number): boolean {
    const laborCap = budget * 0.5;
    const totalLabor = workers + contractorPrice;
    return totalLabor > laborCap;
  }

  private laborBudgetMessage(workers: number, contractorPrice: number, budget: number): string {
    const laborCap = Math.max(0, Math.round(budget * 0.5));
    const totalLabor = workers + contractorPrice;
    return `Labor cap exceeded: workers (${workers}) + contractor (${contractorPrice}) = ${totalLabor}, cap is ${laborCap} (50% of budget).`;
  }
}
