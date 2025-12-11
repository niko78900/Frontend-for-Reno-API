import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css']
})
export class ProjectListComponent implements OnInit {

  projects: any[] = [];
  loading = true;

  constructor(
    private projectService: ProjectService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.projectService.getAllProjects().subscribe({
      next: (data) => {
        this.projects = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed loading projects:', err);
        this.loading = false;
      }
    });
  }

  goToDetails(id: string) {
    this.router.navigate(['/projects', id]);
  }
}
