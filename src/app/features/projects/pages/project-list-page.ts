import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProjectApiService } from '../data-access/project-api.service';
import { CreateProjectRequest, Project } from '../models/project.model';
import { UiButtonComponent, UiDialogComponent, UiEmptyStateComponent } from '../../../shared';

type ProjectListState = 'loading' | 'empty' | 'ready' | 'error';

@Component({
  selector: 'app-project-list-page',
  imports: [ReactiveFormsModule, RouterLink, UiButtonComponent, UiDialogComponent, UiEmptyStateComponent],
  templateUrl: './project-list-page.html',
  styleUrl: './project-list-page.scss',
})
export class ProjectListPage implements OnDestroy {
  private readonly api = inject(ProjectApiService);
  private readonly formBuilder = inject(FormBuilder);
  private successMessageTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly state = signal<ProjectListState>('loading');
  readonly projects = signal<Project[]>([]);
  readonly isCreateDialogOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly errorTitle = signal('No fue posible cargar los proyectos');
  readonly requiresLogin = signal(false);
  readonly successMessage = signal('');
  readonly createForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
  });

  constructor() {
    this.loadProjects();
  }

  ngOnDestroy(): void { this.dismissSuccess(); }

  loadProjects(): void {
    this.state.set('loading');
    this.errorMessage.set('');
    this.errorTitle.set('No fue posible cargar los proyectos');
    this.requiresLogin.set(false);
    this.api.findAll().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.state.set(projects.length === 0 ? 'empty' : 'ready');
      },
      error: (error: unknown) => {
        this.projects.set([]);
        this.setLoadError(error);
        this.state.set('error');
      },
    });
  }

  private setLoadError(error: unknown): void {
    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
      this.errorTitle.set('Tu sesión necesita iniciarse nuevamente');
      this.errorMessage.set('Por seguridad, vuelve a iniciar sesión para acceder a tus proyectos.');
      this.requiresLogin.set(true);
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 0 || error instanceof Error && error.name === 'TimeoutError') {
      this.errorTitle.set('No pudimos conectarnos con UMLink');
      this.errorMessage.set('Revisa tu internet y confirma que el backend esté iniciado. Luego puedes reintentar.');
      return;
    }
    this.errorMessage.set('Ocurrió un problema al cargar tus proyectos. Puedes reintentar o volver al inicio.');
  }
  openCreateDialog(): void {
    this.dismissSuccess();
    this.isCreateDialogOpen.set(true);
  }
  closeCreateDialog(): void {
    this.isCreateDialogOpen.set(false);
    this.createForm.reset();
  }

  private showSuccess(message: string): void {
    this.dismissSuccess();
    this.successMessage.set(message);
    this.successMessageTimeout = setTimeout(() => this.dismissSuccess(), 6_000);
  }

  private dismissSuccess(): void {
    if (this.successMessageTimeout) clearTimeout(this.successMessageTimeout);
    this.successMessageTimeout = null;
    this.successMessage.set('');
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
        this.showSuccess(`El proyecto “${project.name}” fue creado correctamente.`);
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
