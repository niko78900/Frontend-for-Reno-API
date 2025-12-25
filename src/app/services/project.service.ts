import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Project } from '../projects/models/project.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {

  private apiUrl = 'http://localhost:8080/api/projects';

  constructor(private http: HttpClient) {}

  // GET ALL
  getAllProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.apiUrl);
  }

  // GET BY ID
  getProjectById(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.apiUrl}/${id}`);
  }

  // CREATE PROJECT
  createProject(project: Partial<Project>): Observable<Project> {
    return this.http.post<Project>(this.apiUrl, project);
  }

  getProjectsWithCoordinates(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.apiUrl}/with-coordinates`).pipe(
      catchError((err) => {
        console.warn('Coordinate-aware endpoint missing, falling back to full project list', err);
        return this.getAllProjects();
      })
    );
  }

  // UPDATE SLICE (generic)
  updateProjectSlice(id: string, payload: Partial<Project>): Observable<Project> {
    return this.http.patch<Project>(`${this.apiUrl}/${id}`, payload);
  }

  updateProjectName(id: string, name: string): Observable<Project> {
    return this.http.patch<Project>(`${this.apiUrl}/${id}/name`, { name });
  }

  updateProjectAddress(id: string, address: string): Observable<Project> {
    return this.http.patch<Project>(`${this.apiUrl}/${id}/address`, { address });
  }

  updateProjectBudget(id: string, budget: number): Observable<Project> {
    return this.http.patch<Project>(`${this.apiUrl}/${id}/budget`, { budget });
  }

  updateProjectProgress(id: string, progress: number): Observable<Project> {
    return this.http.patch<Project>(`${this.apiUrl}/${id}/progress`, { progress });
  }

  updateProjectEta(id: string, eta: number): Observable<Project> {
    return this.http.patch<Project>(`${this.apiUrl}/${id}/eta`, { eta });
  }

  updateProjectFinished(id: string, finished: boolean): Observable<Project> {
    return this.http.patch<Project>(`${this.apiUrl}/${id}/finished`, { finished });
  }

  updateProjectWorkers(id: string, workers: number): Observable<Project> {
    return this.http.patch<Project>(`${this.apiUrl}/${id}/workers`, { workers });
  }

  updateProjectLocation(id: string, latitude: number, longitude: number): Observable<Project> {
    return this.http.patch<Project>(`${this.apiUrl}/${id}/location`, { latitude, longitude });
  }

  assignProjectContractor(id: string, contractorId: string): Observable<Project> {
    return this.http.patch<Project>(`${this.apiUrl}/${id}/contractor`, { contractorId });
  }

  removeProjectContractor(id: string): Observable<Project> {
    return this.http.patch<Project>(`${this.apiUrl}/${id}/contractor/remove`, {});
  }

  // DELETE PROJECT
  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // ADD TASK INTO PROJECT
  addTask(projectId: string, task: any): Observable<Project> {
    return this.http.post<Project>(`${this.apiUrl}/${projectId}/tasks`, task);
  }

  // REMOVE TASK FROM PROJECT
  removeTask(projectId: string, taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${projectId}/tasks/${taskId}`);
  }
}
