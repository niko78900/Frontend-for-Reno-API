import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Project } from '../projects/models/project.model';
import { APP_CONFIG, AppConfig } from '../config/app-config';

type ProjectApi = Omit<Project, 'id' | 'contractor' | 'contractorId'> & {
  id?: string | number;
  _id?: string | number;
  contractor?: unknown;
  contractorId?: unknown;
};

@Injectable({
  providedIn: 'root'
})
export class ProjectService {

  private apiUrl: string;

  constructor(
    private http: HttpClient,
    @Inject(APP_CONFIG) appConfig: AppConfig
  ) {
    const apiBaseUrl = (appConfig?.apiBaseUrl ?? '').trim().replace(/\/+$/, '');
    this.apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/projects` : '/api/projects';
  }

  // GET ALL
  getAllProjects(): Observable<Project[]> {
    return this.http.get<unknown>(this.apiUrl).pipe(
      map((response) => this.normalizeProjects(response))
    );
  }

  // GET BY ID
  getProjectById(id: string): Observable<Project> {
    return this.http.get<unknown>(`${this.apiUrl}/${id}`).pipe(
      map((response) => this.normalizeProject(response))
    );
  }

  // CREATE PROJECT
  createProject(project: Partial<Project>): Observable<Project> {
    return this.http.post<unknown>(this.apiUrl, project).pipe(
      map((response) => this.normalizeProject(response))
    );
  }

  getProjectsWithCoordinates(): Observable<Project[]> {
    return this.http.get<unknown>(`${this.apiUrl}/with-coordinates`).pipe(
      map((response) => this.normalizeProjects(response)),
      catchError((err) => {
        console.warn('Coordinate-aware endpoint missing, falling back to full project list', err);
        return this.getAllProjects();
      })
    );
  }

  // UPDATE SLICE (generic)
  updateProjectSlice(id: string, payload: Partial<Project>): Observable<Project> {
    return this.http.patch<unknown>(`${this.apiUrl}/${id}`, payload).pipe(
      map((response) => this.normalizeProject(response))
    );
  }

  updateProjectName(id: string, name: string): Observable<Project> {
    return this.http.patch<unknown>(`${this.apiUrl}/${id}/name`, { name }).pipe(
      map((response) => this.normalizeProject(response))
    );
  }

  updateProjectAddress(
    id: string,
    address: string,
    coords?: { latitude?: number; longitude?: number }
  ): Observable<Project> {
    const payload: Record<string, unknown> = { address };
    if (coords?.latitude !== undefined) {
      payload['latitude'] = coords.latitude;
    }
    if (coords?.longitude !== undefined) {
      payload['longitude'] = coords.longitude;
    }
    return this.http.patch<unknown>(`${this.apiUrl}/${id}/address`, payload).pipe(
      map((response) => this.normalizeProject(response))
    );
  }

  updateProjectBudget(id: string, budget: number): Observable<Project> {
    return this.http.patch<unknown>(`${this.apiUrl}/${id}/budget`, { budget }).pipe(
      map((response) => this.normalizeProject(response))
    );
  }

  updateProjectProgress(id: string, progress: number): Observable<Project> {
    return this.http.patch<unknown>(`${this.apiUrl}/${id}/progress`, { progress }).pipe(
      map((response) => this.normalizeProject(response))
    );
  }

  updateProjectEta(id: string, eta: number): Observable<Project> {
    return this.http.patch<unknown>(`${this.apiUrl}/${id}/eta`, { eta }).pipe(
      map((response) => this.normalizeProject(response))
    );
  }

  updateProjectFinished(id: string, finished: boolean): Observable<Project> {
    return this.http.patch<unknown>(`${this.apiUrl}/${id}/finished`, { finished }).pipe(
      map((response) => this.normalizeProject(response))
    );
  }

  updateProjectWorkers(id: string, workers: number): Observable<Project> {
    return this.http.patch<unknown>(`${this.apiUrl}/${id}/workers`, { workers }).pipe(
      map((response) => this.normalizeProject(response))
    );
  }

  assignProjectContractor(id: string, contractorId: string): Observable<Project> {
    return this.http.patch<unknown>(`${this.apiUrl}/${id}/contractor`, { contractorId }).pipe(
      map((response) => this.normalizeProject(response))
    );
  }

  removeProjectContractor(id: string): Observable<Project> {
    return this.http.patch<unknown>(`${this.apiUrl}/${id}/contractor/remove`, {}).pipe(
      map((response) => this.normalizeProject(response))
    );
  }

  // DELETE PROJECT
  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // ADD TASK INTO PROJECT
  addTask(projectId: string, task: any): Observable<Project> {
    return this.http.post<unknown>(`${this.apiUrl}/${projectId}/tasks`, task).pipe(
      map((response) => this.normalizeProject(response))
    );
  }

  // REMOVE TASK FROM PROJECT
  removeTask(projectId: string, taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${projectId}/tasks/${taskId}`);
  }

  private normalizeId(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      return String(value);
    }
    return undefined;
  }

  private normalizeProject(raw: unknown): Project {
    if (!raw || typeof raw !== 'object') {
      return { id: '' } as Project;
    }

    const candidate = raw as ProjectApi;
    const resolvedId = this.normalizeId(candidate.id ?? candidate._id);
    const { _id, id, contractor, contractorId, ...rest } = candidate;
    const normalized: Project = { ...rest, id: resolvedId ?? '' };
    const resolvedContractorId = this.normalizeId(contractorId);

    if (resolvedContractorId) {
      normalized.contractorId = resolvedContractorId;
      normalized.contractor = resolvedContractorId;
    }

    if (typeof contractor === 'string' || typeof contractor === 'number') {
      if (!normalized.contractorId) {
        const legacyId = this.normalizeId(contractor);
        if (legacyId) {
          normalized.contractorId = legacyId;
          normalized.contractor = legacyId;
        }
      }
    } else if (contractor && typeof contractor === 'object') {
      const contractorRecord = contractor as { id?: unknown; _id?: unknown; fullName?: unknown };
      const contractorIdFromRecord = this.normalizeId(contractorRecord.id ?? contractorRecord._id);
      if (contractorIdFromRecord) {
        if (!normalized.contractorId) {
          normalized.contractorId = contractorIdFromRecord;
        }
        if (!normalized.contractor) {
          normalized.contractor = contractorIdFromRecord;
        }
      }
      const contractorName = contractorRecord.fullName;
      if (typeof contractorName === 'string' && !normalized.contractorName) {
        normalized.contractorName = contractorName;
      }
    }

    return normalized;
  }

  private normalizeProjects(raw: unknown): Project[] {
    if (Array.isArray(raw)) {
      return raw.map((item) => this.normalizeProject(item));
    }

    if (raw && typeof raw === 'object') {
      const candidate = raw as { projects?: unknown; data?: unknown };
      if (Array.isArray(candidate.projects)) {
        return candidate.projects.map((item) => this.normalizeProject(item));
      }
      if (Array.isArray(candidate.data)) {
        return candidate.data.map((item) => this.normalizeProject(item));
      }
    }

    return [];
  }
}
