import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthSessionService, isVersionConflict } from '../../../core';
import { DiagramApiService } from '../../diagram/data-access/diagram-api.service';
import { Diagram, DiagramImagePreview } from '../../diagram/models/diagram.model';
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
export class ProjectDetailPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSessionService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly diagramApi = inject(DiagramApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly projectId = this.route.snapshot.paramMap.get('projectId');
  private readonly shouldOpenShareDialog = this.route.snapshot.fragment === 'share';
  private successMessageTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly state = signal<ProjectDetailState>('loading');
  readonly project = signal<Project | null>(null);
  readonly diagrams = signal<Diagram[]>([]);
  readonly isCreateDialogOpen = signal(false);
  readonly isEditProjectDialogOpen = signal(false);
  readonly isEditDiagramDialogOpen = signal(false);
  readonly isImportDialogOpen = signal(false);
  readonly isImageAnalysisDialogOpen = signal(false);
  readonly isDeleteProjectDialogOpen = signal(false);
  readonly isShareDialogOpen = signal(false);
  readonly diagramPendingDeletion = signal<Diagram | null>(null);
  readonly editingDiagram = signal<Diagram | null>(null);
  readonly importFile = signal<File | null>(null);
  readonly imageFile = signal<File | null>(null);
  readonly imagePreview = signal<DiagramImagePreview | null>(null);
  readonly imageAnalysisError = signal('');
  readonly isImageAnalyzing = signal(false);
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

  ngOnDestroy(): void { this.dismissSuccess(); }

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
    this.projectApi.addMember(this.projectId, request).subscribe({ next: (member) => { this.members.update((items) => [...items.filter((item) => item.id !== member.id), member]); this.showSuccess(`${member.name} ahora puede acceder al proyecto.`); this.inviteForm.reset({ email: '', role: 'EDITOR' }); this.isSubmitting.set(false); }, error: () => { this.inviteError.set('No pudimos agregar a esa persona. Verifica que tenga una cuenta registrada.'); this.isSubmitting.set(false); } });
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

  private isOwnerEmail(email: string): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    return this.members().some((member) => member.role === 'OWNER' && member.email.trim().toLowerCase() === normalizedEmail);
  }
  changeMemberRole(member: ProjectMember, role: Exclude<ProjectRole, 'OWNER'>): void {
    if (!this.projectId) return;
    this.projectApi.updateMember(this.projectId, member.id, role).subscribe({ next: (updated) => this.members.update((items) => items.map((item) => item.id === updated.id ? updated : item)), error: () => this.errorMessage.set('No pudimos actualizar el rol.') });
  }
  copyProjectLink(): void {
    if (!this.projectId || !navigator.clipboard) {
      this.errorMessage.set('No fue posible copiar el enlace en este navegador.');
      return;
    }

    this.projectApi.getShareLink(this.projectId).subscribe({
      next: async ({ shareToken }) => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/shared/projects/${shareToken}`);
          this.showSuccess('Enlace público copiado. Quien lo tenga podrá consultar el proyecto sin editarlo.');
        } catch {
          this.errorMessage.set('No fue posible copiar el enlace en este navegador.');
        }
      },
      error: () => this.errorMessage.set('No fue posible crear el enlace compartido.'),
    });
  }
  removeMember(member: ProjectMember): void {
    if (!this.projectId) return;
    this.projectApi.removeMember(this.projectId, member.id).subscribe({ next: () => this.members.update((items) => items.filter((item) => item.id !== member.id)), error: () => this.errorMessage.set('No pudimos retirar a la persona.') });
  }

  openCreateDialog(): void {
    this.dismissSuccess();
    this.isCreateDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    this.isCreateDialogOpen.set(false);
    this.createForm.reset();
  }

  openImportDialog(): void {
    if (!this.canEditDiagrams()) return;
    this.errorMessage.set('');
    this.importFile.set(null);
    this.isImportDialogOpen.set(true);
  }

  closeImportDialog(): void {
    this.importFile.set(null);
    this.isImportDialogOpen.set(false);
  }

  openImageAnalysisDialog(): void {
    if (!this.canEditDiagrams()) return;
    this.imageFile.set(null);
    this.imagePreview.set(null);
    this.imageAnalysisError.set('');
    this.isImageAnalysisDialogOpen.set(true);
  }

  closeImageAnalysisDialog(): void {
    this.imageFile.set(null);
    this.imagePreview.set(null);
    this.imageAnalysisError.set('');
    this.isImageAnalysisDialogOpen.set(false);
  }

  selectImageFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) return;
    const accepted = ['image/png', 'image/jpeg', 'image/webp'];
    if (!accepted.includes(file.type) || !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      this.imageFile.set(null);
      this.imageAnalysisError.set('Selecciona una imagen PNG, JPG o WEBP.');
      return;
    }
    if (file.size > 8_000_000) {
      this.imageFile.set(null);
      this.imageAnalysisError.set('La imagen supera el límite de 8 MB permitido.');
      return;
    }
    this.imageAnalysisError.set('');
    this.imagePreview.set(null);
    this.imageFile.set(file);
  }

  analyzeImage(): void {
    const file = this.imageFile();
    if (!this.projectId || !file) {
      this.imageAnalysisError.set('Selecciona una imagen antes de analizarla.');
      return;
    }
    this.isImageAnalyzing.set(true);
    this.imageAnalysisError.set('');
    this.diagramApi.previewImage(this.projectId, file).subscribe({
      next: (preview) => {
        this.imagePreview.set(preview);
        this.isImageAnalyzing.set(false);
      },
      error: (error: unknown) => {
        this.imageAnalysisError.set(this.imageAnalysisErrorMessage(error));
        this.isImageAnalyzing.set(false);
      },
    });
  }

  createDiagramFromImage(): void {
    const preview = this.imagePreview();
    if (!this.projectId || !preview) return;
    const normalizedName = preview.suggestedName.trim() || 'diagrama-desde-imagen';
    const file = new File([preview.plantUml], `${normalizedName}.puml`, { type: 'text/plain' });
    this.isSubmitting.set(true);
    this.diagramApi.import(this.projectId, file).subscribe({
      next: (diagram) => {
        this.diagrams.update((diagrams) => [diagram, ...diagrams]);
        this.state.set('ready');
        this.showSuccess(`El diagrama “${diagram.name}” fue creado desde la propuesta de IA.`);
        this.closeImageAnalysisDialog();
        this.isSubmitting.set(false);
      },
      error: (error: unknown) => {
        this.imageAnalysisError.set(this.importErrorMessage(error));
        this.isSubmitting.set(false);
      },
    });
  }

  selectImportFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) return;
    if (!/\.(xml|xmi|puml)$/i.test(file.name)) {
      this.importFile.set(null);
      this.errorMessage.set('Selecciona un archivo con extensión .xml, .xmi o .puml.');
      return;
    }
    if (file.size > 1_000_000) {
      this.importFile.set(null);
      this.errorMessage.set('El archivo supera el límite de 1 MB permitido.');
      return;
    }
    this.errorMessage.set('');
    this.importFile.set(file);
  }

  importDiagram(): void {
    const file = this.importFile();
    if (!this.projectId || !this.canEditDiagrams() || !file) {
      this.errorMessage.set('Selecciona un archivo XML, XMI o PlantUML para importar.');
      return;
    }
    this.isSubmitting.set(true);
    this.diagramApi.import(this.projectId, file).subscribe({
      next: (diagram) => {
        this.diagrams.update((diagrams) => [diagram, ...diagrams]);
        this.state.set('ready');
        this.showSuccess(`El diagrama “${diagram.name}” fue importado correctamente.`);
        this.closeImportDialog();
        this.isSubmitting.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.importErrorMessage(error));
        this.isSubmitting.set(false);
      },
    });
  }

  private importErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error === 'object' && error.error !== null) {
      const message = (error.error as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return `No pudimos importar el archivo: ${message}`;
      }
    }
    return 'No pudimos importar el archivo. Verifica que sea XML, XMI o PlantUML compatible y vuelve a intentarlo.';
  }

  private imageAnalysisErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim()) {
        return `No pudimos analizar la imagen: ${error.error}`;
      }
      if (typeof error.error === 'object' && error.error !== null) {
        const message = (error.error as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) return `No pudimos analizar la imagen: ${message}`;
      }
      if (error.status === 0) {
        return 'No pudimos conectar con UMLink. Verifica que el backend esté iniciado y tu conexión vuelva a estar disponible.';
      }
      if (error.status === 429) {
        return 'El proveedor gratuito de IA está temporalmente saturado. Espera unos minutos y vuelve a intentarlo.';
      }
    }
    return 'No pudimos analizar la imagen. El servicio de IA no respondió correctamente; intenta nuevamente en unos minutos.';
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
        this.showSuccess('El proyecto fue actualizado correctamente.');
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
        this.showSuccess('El diagrama fue actualizado correctamente.');
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
        this.showSuccess('El diagrama fue eliminado.');
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
        this.showSuccess(`El diagrama “${diagram.name}” fue creado correctamente.`);
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
