import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Task } from '../projects/models/project.model';
import { APP_CONFIG, AppConfig } from '../config/app-config';

type TaskApi = Omit<Task, 'id'> & {
  id?: string | number;
  _id?: string | number;
};

@Injectable({
  providedIn: 'root'
})
export class TaskService {

  private apiUrl: string;

  constructor(
    private http: HttpClient,
    @Inject(APP_CONFIG) appConfig: AppConfig
  ) {
    const apiBaseUrl = (appConfig?.apiBaseUrl ?? '').trim().replace(/\/+$/, '');
    this.apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/tasks` : '/api/tasks';
  }

  // GET ALL TASKS
  getAllTasks(): Observable<Task[]> {
    return this.http.get<unknown>(this.apiUrl).pipe(
      map((response) => this.normalizeTasks(response))
    );
  }

  // GET BY ID
  getTaskById(id: string): Observable<Task> {
    return this.http.get<unknown>(`${this.apiUrl}/${id}`).pipe(
      map((response) => this.normalizeTask(response))
    );
  }

  // GET BY PROJECT
  getTasksByProject(projectId: string): Observable<Task[]> {
    return this.http.get<unknown>(`${this.apiUrl}/project/${projectId}`).pipe(
      map((response) => this.normalizeTasks(response))
    );
  }

  // CREATE TASK
  createTask(task: Task): Observable<Task> {
    return this.http.post<unknown>(this.apiUrl, task).pipe(
      map((response) => this.normalizeTask(response))
    );
  }

  // UPDATE TASK
  updateTask(id: string, task: Task): Observable<Task> {
    return this.http.put<unknown>(`${this.apiUrl}/${id}`, task).pipe(
      map((response) => this.normalizeTask(response))
    );
  }

  // DELETE TASK
  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
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

  private normalizeTask(raw: unknown): Task {
    if (!raw || typeof raw !== 'object') {
      return { id: '' } as Task;
    }

    const candidate = raw as TaskApi;
    const resolvedId = this.normalizeId(candidate.id ?? candidate._id);
    const { _id, id, ...rest } = candidate;
    return { ...rest, id: resolvedId ?? '' };
  }

  private normalizeTasks(raw: unknown): Task[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((item) => this.normalizeTask(item));
  }
}
