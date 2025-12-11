import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {

  private apiUrl = 'http://localhost:8080/api/projects';

  constructor(private http: HttpClient) {}

  // GET ALL
  getAllProjects(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // GET BY ID
  getProjectById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  // CREATE PROJECT
  createProject(project: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, project);
  }

  // DELETE PROJECT
  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // ADD TASK INTO PROJECT
  addTask(projectId: string, task: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${projectId}/tasks`, task);
  }

  // REMOVE TASK FROM PROJECT
  removeTask(projectId: string, taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${projectId}/tasks/${taskId}`);
  }
}
