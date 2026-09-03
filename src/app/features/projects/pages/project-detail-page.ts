import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DiagramApiService } from '../../diagram/data-access/diagram-api.service';
import { Diagram } from '../../diagram/models/diagram.model';
import { ProjectApiService } from '../data-access/project-api.service';
import { Project } from '../models/project.model';
import { UiButtonComponent, UiDialogComponent, UiEmptyStateComponent, UiPanelComponent } from '../../../shared';

type ProjectDetailState = 'loading' | 'empty' | 'ready' | 'error';

@Component({
  selector: 'app-project-detail-page',
  imports: [ReactiveFormsModule, RouterLink, UiButtonComponent, UiDialogComponent, UiEmptyStateComponent, UiPanelComponent],
  templateUrl: './project-detail-page.html',
  styleUrl: './project-detail-page.scss',
})
export class ProjectDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly projectApi = inject(ProjectApiService);
  private readonly diagramApi = inject(DiagramApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly projectId = this.route.snapshot.paramMap.get('projectId');

  readonly state = signal<ProjectDetailState>('loading');
  readonly project = signal<Project | null>(null);
  readonly diagrams = signal<Diagram[]>([]);
  readonly isCreateDialogOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly createForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });

  constructor() {
    this.loadProject();
  }

  loadProject(): void {
    if (!this.projectId) {
      this.errorMessage.set('El identificador del proyecto no es válido.');
      this.state.set('error');
      return;
    }

    this.state.set('loading');
    this.errorMessage.set('');
    forkJoin({
      project: this.projectApi.findById(this.projectId),
      diagrams: this.diagramApi.findByProject(this.projectId),
    }).subscribe({
      next: ({ project, diagrams }) => {
        this.project.set(project);
        this.diagrams.set(diagrams);
        this.state.set(diagrams.length === 0 ? 'empty' : 'ready');
      },
      error: () => {
        this.project.set(null);
        this.diagrams.set([]);
        this.errorMessage.set('No pudimos cargar este proyecto. Inténtalo nuevamente.');
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

  createDiagram(): void {
    if (!this.projectId || this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.diagramApi.create(this.projectId, this.createForm.getRawValue()).subscribe({
      next: (diagram) => {
        this.diagrams.update((diagrams) => [diagram, ...diagrams]);
        this.state.set('ready');
        this.successMessage.set(`El diagrama “${diagram.name}” fue creado correctamente.`);
        this.isSubmitting.set(false);
        this.closeCreateDialog();
      },
      error: () => {
        this.errorMessage.set(
          'No pudimos crear el diagrama. Revisa el nombre e inténtalo nuevamente.',
        );
        this.isSubmitting.set(false);
      },
    });
  }
}
