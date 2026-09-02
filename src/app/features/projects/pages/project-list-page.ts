import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProjectApiService } from '../data-access/project-api.service';
import { CreateProjectRequest, Project } from '../models/project.model';

type ProjectListState = 'loading' | 'empty' | 'ready' | 'error';

@Component({
  selector: 'app-project-list-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './project-list-page.html',
  styleUrl: './project-list-page.scss',
})
export class ProjectListPage {
  private readonly api = inject(ProjectApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly state = signal<ProjectListState>('loading');
  readonly projects = signal<Project[]>([]);
  readonly isCreateDialogOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly createForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
  });

  constructor() {
    this.loadProjects();
  }

  loadProjects(): void {
    this.state.set('loading');
    this.errorMessage.set('');
    this.api.findAll().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.state.set(projects.length === 0 ? 'empty' : 'ready');
      },
      error: () => {
        this.projects.set([]);
        this.errorMessage.set(
          'No pudimos cargar tus proyectos. Verifica que el backend esté activo.',
        );
        this.state.set('error');
      },
    });
  }

  openCreateDialog(): void {
    this.successMessage.set('');
    this.isCreateDialogOpen.set(true);
  }
  closeCreateDialog(): void {
    this.isCreateDialogOpen.set(false);
    this.createForm.reset();
  }

  createProject(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const request: CreateProjectRequest = this.createForm.getRawValue();
    this.api.create(request).subscribe({
      next: (project) => {
        this.projects.update((projects) => [project, ...projects]);
        this.state.set('ready');
        this.successMessage.set(`El proyecto “${project.name}” fue creado correctamente.`);
        this.isSubmitting.set(false);
        this.closeCreateDialog();
      },
      error: () => {
        this.errorMessage.set(
          'No pudimos crear el proyecto. Revisa los datos e inténtalo nuevamente.',
        );
        this.isSubmitting.set(false);
      },
    });
  }
}
