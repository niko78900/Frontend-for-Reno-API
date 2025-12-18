import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { Project, Task } from '../models/project.model';
import { finalize } from 'rxjs/operators';
import { TaskService } from '../../services/task.service';

@Component({
  selector: 'app-project-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
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

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private taskService: TaskService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')?.trim();

    if (!id) {
      this.loading = false;
      this.errorMessage = 'Project id is missing from the route.';
      return;
    }

    const stateProject = window.history.state?.project as Project | undefined;

    if (stateProject && stateProject.id === id) {
      this.project = stateProject;
      this.loading = false;
      this.loadTasks(id);
      return;
    }

    this.fetchProject(id);
  }

  private fetchProject(id: string): void {
    this.loading = true;
    this.errorMessage = '';

    this.projectService.getProjectById(id)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (data) => {
          this.project = data;
          this.loadTasks(id);
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
}
