import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthSessionService, isVersionConflict } from '../../../core';
import { DiagramApiService } from '../../diagram/data-access/diagram-api.service';
import { Diagram } from '../../diagram/models/diagram.model';
import { ProjectApiService } from '../data-access/project-api.service';
import { AddProjectMemberRequest, Project, ProjectMember, ProjectRole, UpdateProjectRequest } from '../models/project.model';
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
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSessionService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly diagramApi = inject(DiagramApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly projectId = this.route.snapshot.paramMap.get('projectId');
  private readonly shouldOpenShareDialog = this.route.snapshot.fragment === 'share';

  readonly state = signal<ProjectDetailState>('loading');
  readonly project = signal<Project | null>(null);
  readonly diagrams = signal<Diagram[]>([]);
  readonly isCreateDialogOpen = signal(false);
  readonly isEditProjectDialogOpen = signal(false);
  readonly isEditDiagramDialogOpen = signal(false);
  readonly isDeleteProjectDialogOpen = signal(false);
  readonly isShareDialogOpen = signal(false);
  readonly diagramPendingDeletion = signal<Diagram | null>(null);
  readonly editingDiagram = signal<Diagram | null>(null);
  readonly members = signal<ProjectMember[]>([]);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly inviteError = signal('');
  readonly createForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });
  readonly projectEditForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
  });
  readonly diagramEditForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });
  readonly inviteForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['EDITOR' as Exclude<ProjectRole, 'OWNER'>],
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
      members: this.projectApi.findMembers(this.projectId),
    }).subscribe({
      next: ({ project, diagrams, members }) => {
        this.project.set(project);
        this.diagrams.set(diagrams);
        this.members.set(members);
        this.state.set(diagrams.length === 0 ? 'empty' : 'ready');
        if (this.shouldOpenShareDialog && this.canManageMembers()) this.openShareDialog();
      },
      error: () => {
        this.project.set(null);
        this.diagrams.set([]);
        this.errorMessage.set('No pudimos cargar este proyecto. Inténtalo nuevamente.');
        this.state.set('error');
      },
    });
  }

  canManageMembers(): boolean { return this.members().some((member) => member.userId === this.currentUserId() && member.role === 'OWNER'); }
  canEditDiagrams(): boolean {
    return this.members().some((member) => member.userId === this.currentUserId() && (member.role === 'OWNER' || member.role === 'EDITOR'));
  }
  private currentUserId(): string | null { return this.authSession.user()?.userId ?? null; }
  openShareDialog(): void { this.errorMessage.set(''); this.inviteError.set(''); this.isShareDialogOpen.set(true); }
  closeShareDialog(): void { this.isShareDialogOpen.set(false); this.inviteError.set(''); this.inviteForm.reset({ email: '', role: 'EDITOR' }); }
  setInviteRole(role: Exclude<ProjectRole, 'OWNER'>): void {
    this.inviteForm.controls.role.setValue(role);
  }
  inviteMember(): void {
    if (!this.projectId || this.inviteForm.invalid) { this.inviteForm.markAllAsTouched(); return; }
    const request: AddProjectMemberRequest = this.inviteForm.getRawValue();
    if (this.isOwnerEmail(request.email)) {
      this.inviteError.set('Ese correo pertenece a la propietaria del proyecto, que ya tiene acceso como Owner.');
      return;
    }
    this.inviteError.set('');
    this.isSubmitting.set(true);
    this.projectApi.addMember(this.projectId, request).subscribe({ next: (member) => { this.members.update((items) => [...items.filter((item) => item.id !== member.id), member]); this.successMessage.set(`${member.name} ahora puede acceder al proyecto.`); this.inviteForm.reset({ email: '', role: 'EDITOR' }); this.isSubmitting.set(false); }, error: () => { this.inviteError.set('No pudimos agregar a esa persona. Verifica que tenga una cuenta registrada.'); this.isSubmitting.set(false); } });
  }
  private isOwnerEmail(email: string): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    return this.members().some((member) => member.role === 'OWNER' && member.email.trim().toLowerCase() === normalizedEmail);
  }
  changeMemberRole(member: ProjectMember, role: Exclude<ProjectRole, 'OWNER'>): void {
    if (!this.projectId) return;
    this.projectApi.updateMember(this.projectId, member.id, role).subscribe({ next: (updated) => this.members.update((items) => items.map((item) => item.id === updated.id ? updated : item)), error: () => this.errorMessage.set('No pudimos actualizar el rol.') });
  }
  async copyProjectLink(): Promise<void> {
    if (!this.projectId || !navigator.clipboard) {
      this.errorMessage.set('No fue posible copiar el enlace en este navegador.');
      return;
    }

    try {
      await navigator.clipboard.writeText(`${window.location.origin}/projects/${this.projectId}`);
      this.successMessage.set('Enlace del proyecto copiado. Recuerda que el acceso requiere invitación.');
    } catch {
      this.errorMessage.set('No fue posible copiar el enlace en este navegador.');
    }
  }
  removeMember(member: ProjectMember): void {
    if (!this.projectId) return;
    this.projectApi.removeMember(this.projectId, member.id).subscribe({ next: () => this.members.update((items) => items.filter((item) => item.id !== member.id)), error: () => this.errorMessage.set('No pudimos retirar a la persona.') });
  }

  openCreateDialog(): void {
    this.successMessage.set('');
    this.isCreateDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    this.isCreateDialogOpen.set(false);
    this.createForm.reset();
  }

  openEditProjectDialog(): void {
    const project = this.project();
    if (!project) return;
    this.errorMessage.set('');
    this.projectEditForm.reset({ name: project.name, description: project.description ?? '' });
    this.isEditProjectDialogOpen.set(true);
  }

  closeEditProjectDialog(): void { this.isEditProjectDialogOpen.set(false); }

  updateProject(): void {
    const project = this.project();
    if (!project || this.projectEditForm.invalid) {
      this.projectEditForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const formValue = this.projectEditForm.getRawValue();
    const request: UpdateProjectRequest = { ...formValue, version: project.version };
    this.projectApi.update(project.id, request).subscribe({
      next: (updatedProject) => {
        this.project.set(updatedProject);
        this.successMessage.set('El proyecto fue actualizado correctamente.');
        this.isEditProjectDialogOpen.set(false);
        this.isSubmitting.set(false);
      },
      error: (error: unknown) => {
        this.handleProjectConflict(error);
        this.isSubmitting.set(false);
      },
    });
  }

  requestProjectDeletion(): void { this.isDeleteProjectDialogOpen.set(true); }

  cancelProjectDeletion(): void { this.isDeleteProjectDialogOpen.set(false); }

  deleteProject(): void {
    const project = this.project();
    if (!project) return;
    this.isSubmitting.set(true);
    this.projectApi.delete(project.id, project.version).subscribe({
      next: () => this.router.navigate(['/projects']),
      error: (error: unknown) => {
        this.handleProjectConflict(error);
        this.isSubmitting.set(false);
      },
    });
  }

  openEditDiagramDialog(diagram: Diagram): void {
    this.errorMessage.set('');
    this.editingDiagram.set(diagram);
    this.diagramEditForm.reset({ name: diagram.name });
    this.isEditDiagramDialogOpen.set(true);
  }

  closeEditDiagramDialog(): void {
    this.isEditDiagramDialogOpen.set(false);
    this.editingDiagram.set(null);
  }

  updateDiagram(): void {
    const diagram = this.editingDiagram();
    if (!diagram || this.diagramEditForm.invalid) {
      this.diagramEditForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.diagramApi.update(diagram.id, { ...this.diagramEditForm.getRawValue(), version: diagram.version }).subscribe({
      next: (updatedDiagram) => {
        this.diagrams.update((diagrams) => diagrams.map((item) => item.id === updatedDiagram.id ? updatedDiagram : item));
        this.successMessage.set('El diagrama fue actualizado correctamente.');
        this.closeEditDiagramDialog();
        this.isSubmitting.set(false);
      },
      error: (error: unknown) => {
        this.handleDiagramConflict(error);
        this.isSubmitting.set(false);
      },
    });
  }

  requestDiagramDeletion(diagram: Diagram): void { this.diagramPendingDeletion.set(diagram); }

  cancelDiagramDeletion(): void { this.diagramPendingDeletion.set(null); }

  deleteDiagram(): void {
    const diagram = this.diagramPendingDeletion();
    if (!diagram) return;
    this.isSubmitting.set(true);
    this.diagramApi.delete(diagram.id, diagram.version).subscribe({
      next: () => {
        this.diagrams.update((diagrams) => diagrams.filter((item) => item.id !== diagram.id));
        this.state.set(this.diagrams().length === 0 ? 'empty' : 'ready');
        this.successMessage.set('El diagrama fue eliminado.');
        this.cancelDiagramDeletion();
        this.isSubmitting.set(false);
      },
      error: (error: unknown) => {
        this.handleDiagramConflict(error);
        this.isSubmitting.set(false);
      },
    });
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

  private handleProjectConflict(error: unknown): void {
    if (isVersionConflict(error)) {
      this.loadProject();
      this.closeEditProjectDialog();
      this.cancelProjectDeletion();
      this.errorMessage.set('El proyecto cambió en otra sesión. Recargamos sus datos antes de permitir otro cambio.');
      return;
    }
    this.errorMessage.set('No pudimos actualizar el proyecto. Revisa los datos e inténtalo nuevamente.');
  }

  private handleDiagramConflict(error: unknown): void {
    if (isVersionConflict(error)) {
      this.loadProject();
      this.closeEditDiagramDialog();
      this.cancelDiagramDeletion();
      this.errorMessage.set('El diagrama cambió en otra sesión. Recargamos sus datos antes de permitir otro cambio.');
      return;
    }
    this.errorMessage.set('No pudimos guardar el cambio del diagrama. Inténtalo nuevamente.');
  }
}
