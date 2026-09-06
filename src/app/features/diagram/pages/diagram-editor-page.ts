import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnDestroy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthSessionService, isVersionConflict } from '../../../core';
import { CollaborationWebSocketService, DiagramEvent } from '../../collaboration';
import { UiButtonComponent, UiDialogComponent } from '../../../shared';
import { DiagramApiService } from '../data-access/diagram-api.service';
import { AttributeDataType, Diagram, DiagramActivity, DiagramDrawing, InterchangeFormat, OperationReturnType, RelationAlignmentPoint, RelationType, UmlClass, UmlOperation, UmlRelation } from '../models/diagram.model';
import { ProjectApiService } from '../../projects/data-access/project-api.service';
import { ProjectRole } from '../../projects/models/project.model';

type EditorState = 'loading' | 'empty' | 'ready' | 'error' | 'selection';
type EditorMode = 'select' | 'place-class' | 'create-relation' | 'draw' | 'erase';
type CanvasPoint = { x: number; y: number };
type RelationTool = { id: string; type: RelationType; label: string; hint: string; createsAssociationClass: boolean };
type DeleteTarget = { kind: 'class' | 'attribute' | 'operation' | 'relation'; id: string; label: string };
type CardinalityEndpoint = 'source' | 'target';
type CanvasCardinalityEdit = { relationId: string; endpoint: CardinalityEndpoint };
type RelationGeometry = { x1: number; y1: number; x2: number; y2: number; points: string; alignmentPoints: RelationAlignmentPoint[]; sourceLabelX: number; sourceLabelY: number; targetLabelX: number; targetLabelY: number; labelX: number; labelY: number };
type RemoteDrawingPreview = { userId: string; name: string; svgPath: string };
type RemoteClassInteraction = { userId: string; name: string; classId: string };
type CollaborationActivity = { id: string; name: string; action: string };
type ActivityHistoryState = 'idle' | 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-diagram-editor-page',
  imports: [ReactiveFormsModule, RouterLink, NgTemplateOutlet, UiButtonComponent, UiDialogComponent],
  templateUrl: './diagram-editor-page.html',
  styleUrl: './diagram-editor-page.scss',
})
export class DiagramEditorPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly diagramApi = inject(DiagramApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authSession = inject(AuthSessionService);
  private readonly collaboration = inject(CollaborationWebSocketService);
  private readonly diagramId = this.route.snapshot.paramMap.get('diagramId');

  readonly state = signal<EditorState>('loading');
  readonly diagram = signal<Diagram | null>(null);
  readonly classes = signal<UmlClass[]>([]);
  readonly relations = signal<UmlRelation[]>([]);
  readonly selectedClassId = signal<string | null>(null);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly isCreateDialogOpen = signal(false);
  readonly isEditDiagramDialogOpen = signal(false);
  readonly isDeleteDiagramDialogOpen = signal(false);
  readonly isAssociationClassDialogOpen = signal(false);
  readonly isActivityDialogOpen = signal(false);
  readonly isExportDialogOpen = signal(false);
  readonly isSummaryVisible = signal(true);
  readonly activityHistory = signal<DiagramActivity[]>([]);
  readonly activityHistoryState = signal<ActivityHistoryState>('idle');
  readonly activitySummary = computed(() => this.activityHistory().slice(0, 3));
  readonly isSubmitting = signal(false);
  readonly editorMode = signal<EditorMode>('select');
  readonly pendingClassName = signal<string | null>(null);
  readonly placementPreview = signal<CanvasPoint | null>(null);
  readonly relationSourceId = signal<string | null>(null);
  readonly isCreatingAssociationClass = signal(false);
  readonly pendingAssociationClassName = signal<string | null>(null);
  readonly relationPointer = signal<CanvasPoint | null>(null);
  readonly attributeEditorClassId = signal<string | null>(null);
  readonly selectedRelationId = signal<string | null>(null);
  readonly editingAttributeId = signal<string | null>(null);
  readonly operationEditorClassId = signal<string | null>(null);
  readonly editingOperationId = signal<string | null>(null);
  readonly deleteTarget = signal<DeleteTarget | null>(null);
  readonly freehandPaths = signal<DiagramDrawing[]>([]);
  readonly currentDrawing = signal<string | null>(null);
  readonly zoom = signal(1);
  readonly editingRelationLabelId = signal<string | null>(null);
  readonly editingCanvasCardinality = signal<CanvasCardinalityEdit | null>(null);
  readonly collaborationState = this.collaboration.state;
  readonly participants = this.collaboration.participants;
  readonly projectRole = signal<ProjectRole | null>(null);
  readonly remoteDrawingPreviews = signal<RemoteDrawingPreview[]>([]);
  readonly remoteClassInteractions = signal<RemoteClassInteraction[]>([]);
  readonly collaborationActivity = signal<CollaborationActivity[]>([]);
  readonly canEdit = computed(() => this.projectRole() === 'OWNER' || this.projectRole() === 'EDITOR');
  readonly canvasSize = computed(() => ({
    width: Math.max(1200, ...this.classes().map((umlClass) => umlClass.positionX + 340)),
    height: Math.max(620, ...this.classes().map((umlClass) => umlClass.positionY + this.umlClassHeight(umlClass) + 180)),
  }));
  readonly relationTools: readonly RelationTool[] = [
    { id: 'association', type: 'ASSOCIATION', label: 'Asociación', hint: 'Relación estructural', createsAssociationClass: false },
    { id: 'association-class', type: 'ASSOCIATION', label: 'Clase intermedia', hint: 'Clase de asociación', createsAssociationClass: true },
    { id: 'aggregation', type: 'AGGREGATION', label: 'Agregación', hint: 'Todo y partes', createsAssociationClass: false },
    { id: 'composition', type: 'COMPOSITION', label: 'Composición', hint: 'Parte dependiente', createsAssociationClass: false },
    { id: 'generalization', type: 'GENERALIZATION', label: 'Herencia', hint: 'Generalización', createsAssociationClass: false },
    { id: 'realization', type: 'REALIZATION', label: 'Realización', hint: 'Implementa interfaz', createsAssociationClass: false },
    { id: 'dependency', type: 'DEPENDENCY', label: 'Dependencia', hint: 'Uso temporal', createsAssociationClass: false },
  ];
  readonly attributeTypes: readonly { value: AttributeDataType; label: string }[] = [
    { value: 'STRING', label: 'String' }, { value: 'INTEGER', label: 'Integer' },
    { value: 'LONG', label: 'Long' }, { value: 'DOUBLE', label: 'Double' },
    { value: 'BOOLEAN', label: 'Boolean' }, { value: 'UUID', label: 'UUID' },
    { value: 'LOCAL_DATE', label: 'LocalDate' }, { value: 'LOCAL_DATE_TIME', label: 'LocalDateTime' },
  ];
  readonly createForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });
  readonly diagramEditForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });
  readonly associationClassForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });
  readonly attributeLineForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    dataType: ['STRING' as AttributeDataType, Validators.required],
    visibility: ['PRIVATE'],
    primaryKey: [false],
  });
  readonly classEditForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });
  readonly attributeEditForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    dataType: ['STRING' as AttributeDataType, Validators.required],
    visibility: ['PRIVATE'],
    primaryKey: [false],
  });
  readonly operationForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    visibility: ['PUBLIC' as 'PUBLIC' | 'PRIVATE' | 'PROTECTED', Validators.required],
    returnType: ['VOID' as OperationReturnType, Validators.required],
  });
  readonly operationParameters = this.formBuilder.nonNullable.array<ReturnType<DiagramEditorPage['createOperationParameterForm']>>([]);
  readonly relationForm = this.formBuilder.nonNullable.group({
    type: ['ASSOCIATION' as RelationType, Validators.required],
    label: [''],
    sourceCardinality: ['1..1'],
    targetCardinality: ['1..1'],
  });
  readonly relationEditForm = this.formBuilder.nonNullable.group({
    sourceClassId: ['', Validators.required],
    targetClassId: ['', Validators.required],
    type: ['ASSOCIATION' as RelationType, Validators.required],
    label: [''],
    sourceCardinality: ['1..1'],
    targetCardinality: ['1..1'],
    associationClassId: [''],
  });
  readonly relationLabelForm = this.formBuilder.nonNullable.group({
    label: ['', Validators.maxLength(120)],
  });
  readonly canvasCardinalityForm = this.formBuilder.nonNullable.group({
    value: ['1..1', Validators.required],
  });
  private draggedClassId: string | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private isErasing = false;
  private draggedRelationId: string | null = null;
  private draggedAlignmentPointIndex: number | null = null;
  private readonly deletingDrawingIds = new Set<string>();
  private lastDrawingPreviewAt = 0;
  private readonly remoteInteractionTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly activityTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.loadDiagram();
    this.collaboration.events$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleCollaborationEvent(event));
  }

  ngOnDestroy(): void {
    this.remoteInteractionTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.activityTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.collaboration.disconnect();
  }

  loadDiagram(): void {
    if (!this.diagramId) {
      this.state.set('selection');
      return;
    }

    this.state.set('loading');
    this.errorMessage.set('');
    this.diagramApi.findDetails(this.diagramId).subscribe({
      next: (details) => {
        this.diagram.set(details.diagram);
        this.classes.set(details.classes);
        this.relations.set(details.relations);
        this.freehandPaths.set(details.drawings);
        this.state.set(details.classes.length === 0 ? 'empty' : 'ready');
        this.loadProjectRole(details.diagram.projectId);
        this.collaboration.connect(details.diagram.id);
        this.loadActivityHistory();
      },
      error: () => {
        this.errorMessage.set('No pudimos cargar este diagrama. Inténtalo nuevamente.');
        this.state.set('error');
      },
    });
  }

  openActivityHistory(): void {
    if (!this.diagramId) return;
    this.isActivityDialogOpen.set(true);
    this.loadActivityHistory();
  }

  private loadActivityHistory(): void {
    if (!this.diagramId) return;
    this.activityHistoryState.set('loading');
    this.diagramApi.findActivity(this.diagramId).subscribe({
      next: (activity) => {
        this.activityHistory.set(activity);
        this.activityHistoryState.set('ready');
      },
      error: () => this.activityHistoryState.set('error'),
    });
  }

  closeActivityHistory(): void {
    this.isActivityDialogOpen.set(false);
  }

  toggleSummary(): void {
    this.isSummaryVisible.update((visible) => !visible);
  }

  openExportDialog(): void { this.isExportDialogOpen.set(true); }

  closeExportDialog(): void { this.isExportDialogOpen.set(false); }

  downloadDiagram(format: InterchangeFormat): void {
    const diagram = this.diagram();
    if (!diagram) return;
    this.isSubmitting.set(true);
    this.diagramApi.export(diagram.id, format).subscribe({
      next: (file) => {
        const link = document.createElement('a');
        const objectUrl = URL.createObjectURL(file);
        link.href = objectUrl;
        link.download = `${this.fileNameFrom(diagram.name)}.${format === 'XML' ? 'xml' : format === 'EA_SCRIPT' ? 'js' : format === 'PLANT_UML' ? 'puml' : 'xmi'}`;
        link.click();
        URL.revokeObjectURL(objectUrl);
        this.closeExportDialog();
        this.successMessage.set(`El archivo ${format === 'EA_XMI' ? 'para Enterprise Architect 15' : format === 'EA_SCRIPT' ? 'de script para Enterprise Architect 15' : format === 'PLANT_UML' ? 'PlantUML' : format} fue descargado.`);
        this.isSubmitting.set(false);
      },
      error: () => {
        this.errorMessage.set(`No pudimos descargar el archivo ${format}.`);
        this.isSubmitting.set(false);
      },
    });
  }

  openCreateDialog(): void {
    if (!this.ensureCanEdit()) return;
    this.successMessage.set('');
    this.errorMessage.set('');
    this.isCreateDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    this.isCreateDialogOpen.set(false);
    this.createForm.reset();
  }

  openProjectSharing(): void {
    const diagram = this.diagram();
    if (!diagram || this.projectRole() !== 'OWNER') return;
    this.router.navigate(['/projects', diagram.projectId], { fragment: 'share' });
  }

  openEditDiagramDialog(): void {
    if (!this.ensureCanEdit()) return;
    const diagram = this.diagram();
    if (!diagram) return;
    this.errorMessage.set('');
    this.diagramEditForm.reset({ name: diagram.name });
    this.isEditDiagramDialogOpen.set(true);
  }

  closeEditDiagramDialog(): void { this.isEditDiagramDialogOpen.set(false); }

  updateDiagram(): void {
    if (!this.ensureCanEdit()) return;
    const diagram = this.diagram();
    if (!diagram || this.diagramEditForm.invalid) {
      this.diagramEditForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.diagramApi.update(diagram.id, { ...this.diagramEditForm.getRawValue(), version: diagram.version }).subscribe({
      next: (updatedDiagram) => {
        this.diagram.set(updatedDiagram);
        this.isEditDiagramDialogOpen.set(false);
        this.successMessage.set('El diagrama fue actualizado correctamente.');
        this.isSubmitting.set(false);
      },
      error: (error: unknown) => {
        this.handleDiagramConflict(error, 'No pudimos actualizar el diagrama.');
        this.isSubmitting.set(false);
      },
    });
  }

  requestDiagramDeletion(): void {
    if (!this.ensureCanEdit()) return;
    this.isDeleteDiagramDialogOpen.set(true);
  }

  cancelDiagramDeletion(): void { this.isDeleteDiagramDialogOpen.set(false); }

  deleteDiagram(): void {
    if (!this.ensureCanEdit()) return;
    const diagram = this.diagram();
    if (!diagram) return;
    this.isSubmitting.set(true);
    this.diagramApi.delete(diagram.id, diagram.version).subscribe({
      next: () => this.router.navigate(['/projects', diagram.projectId]),
      error: (error: unknown) => {
        this.handleDiagramConflict(error, 'No pudimos eliminar el diagrama.');
        this.isSubmitting.set(false);
      },
    });
  }

  openAssociationClassDialog(): void {
    if (!this.ensureCanEdit()) return;
    if (this.classes().length < 2) {
      this.errorMessage.set('Crea al menos dos clases antes de agregar una clase intermedia.');
      return;
    }
    this.associationClassForm.reset({ name: '' });
    this.isAssociationClassDialogOpen.set(true);
  }

  closeAssociationClassDialog(): void {
    this.isAssociationClassDialogOpen.set(false);
    this.associationClassForm.reset({ name: '' });
  }

  prepareAssociationClassRelation(): void {
    if (!this.ensureCanEdit()) return;
    if (this.associationClassForm.invalid) {
      this.associationClassForm.markAllAsTouched();
      return;
    }
    this.pendingAssociationClassName.set(this.associationClassForm.controls.name.value.trim());
    this.closeAssociationClassDialog();
    this.activateRelationTool('ASSOCIATION');
    this.isCreatingAssociationClass.set(true);
    this.successMessage.set('Arrastra desde la primera clase hasta la segunda para crear la asociación y su clase intermedia.');
  }

  prepareClassPlacement(): void {
    if (!this.ensureCanEdit()) return;
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.pendingClassName.set(this.createForm.controls.name.value.trim());
    this.editorMode.set('place-class');
    this.placementPreview.set(null);
    this.closeCreateDialog();
    this.successMessage.set('Haz clic en un espacio libre del lienzo para colocar la nueva clase.');
  }

  selectClass(umlClass: UmlClass): void {
    this.selectedClassId.set(umlClass.id);
    this.selectedRelationId.set(null);
    this.classEditForm.reset({ name: umlClass.name });
  }

  selectedClass(): UmlClass | null {
    const id = this.selectedClassId();
    return id ? this.classes().find((umlClass) => umlClass.id === id) ?? null : null;
  }

  selectedRelation(): UmlRelation | null {
    const id = this.selectedRelationId();
    return id ? this.relations().find((relation) => relation.id === id) ?? null : null;
  }

  selectRelation(relation: UmlRelation): void {
    this.selectedClassId.set(null);
    this.selectedRelationId.set(relation.id);
    this.relationEditForm.reset({
      sourceClassId: relation.sourceClassId,
      targetClassId: relation.targetClassId,
      type: relation.type,
      label: relation.label ?? '',
      sourceCardinality: relation.sourceCardinality ?? '',
      targetCardinality: relation.targetCardinality ?? '',
      associationClassId: relation.associationClassId ?? '',
    });
  }

  saveClass(): void {
    if (!this.ensureCanEdit()) return;
    const umlClass = this.selectedClass();
    if (!umlClass || this.classEditForm.invalid) {
      this.classEditForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const formValue = this.classEditForm.getRawValue();
    this.diagramApi.updateClass(umlClass.id, { name: formValue.name, fillColor: umlClass.fillColor, positionX: umlClass.positionX, positionY: umlClass.positionY }).subscribe({
      next: (updatedClass) => {
        const classWithAttributes = { ...updatedClass, fillColor: updatedClass.fillColor ?? umlClass.fillColor, attributes: umlClass.attributes, operations: updatedClass.operations ?? umlClass.operations };
        this.classes.update((classes) => classes.map((item) => item.id === updatedClass.id ? classWithAttributes : item));
        this.selectClass(classWithAttributes);
        this.successMessage.set('La clase fue actualizada.');
        this.isSubmitting.set(false);
      },
      error: () => { this.errorMessage.set('No pudimos actualizar la clase.'); this.isSubmitting.set(false); },
    });
  }

  addAttribute(): void {
    if (!this.ensureCanEdit()) return;
    const classId = this.attributeEditorClassId();
    const selectedClass = classId
      ? this.classes().find((umlClass) => umlClass.id === classId) ?? null
      : null;
    if (!selectedClass || this.attributeLineForm.invalid) {
      this.attributeLineForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.diagramApi.createAttribute(selectedClass.id, this.attributeLineForm.getRawValue()).subscribe({
      next: (createdAttribute) => {
        this.classes.update((classes) => classes.map((umlClass) =>
          umlClass.id === selectedClass.id
            ? {
                ...umlClass,
                attributes: [
                  ...umlClass.attributes.map((attribute) => createdAttribute.primaryKey ? { ...attribute, primaryKey: false } : attribute),
                  createdAttribute,
                ],
              }
            : umlClass,
        ));
        this.successMessage.set(`El atributo “${createdAttribute.name}” fue agregado.`);
        this.isSubmitting.set(false);
        this.attributeLineForm.reset({ name: '', dataType: 'STRING', visibility: 'PRIVATE', primaryKey: false });
      },
      error: () => {
        this.errorMessage.set('No pudimos agregar el atributo. Revisa los datos e inténtalo nuevamente.');
        this.isSubmitting.set(false);
      },
    });
  }

  openAttributeEditor(umlClass: UmlClass): void {
    if (!this.ensureCanEdit()) return;
    this.selectClass(umlClass);
    this.attributeEditorClassId.set(umlClass.id);
    this.attributeLineForm.reset({ name: '', dataType: 'STRING', visibility: 'PRIVATE', primaryKey: false });
  }

  closeAttributeEditor(): void {
    this.attributeEditorClassId.set(null);
    this.attributeLineForm.reset({ name: '', dataType: 'STRING', visibility: 'PRIVATE', primaryKey: false });
  }

  startAttributeEdit(attribute: { id: string; name: string; dataType: string; visibility: string; primaryKey: boolean }): void {
    if (!this.ensureCanEdit()) return;
    this.editingAttributeId.set(attribute.id);
    const type = this.attributeTypes.find((item) => item.label === attribute.dataType)?.value ?? 'STRING';
    this.attributeEditForm.reset({ name: attribute.name, dataType: type, visibility: attribute.visibility, primaryKey: attribute.primaryKey });
  }

  openOperationEditor(umlClass: UmlClass): void {
    if (!this.ensureCanEdit()) return;
    this.selectClass(umlClass);
    this.operationEditorClassId.set(umlClass.id);
    this.editingOperationId.set(null);
    this.operationForm.reset({ name: '', visibility: 'PUBLIC', returnType: 'VOID' });
    this.resetOperationParameters([]);
  }

  startOperationEdit(operation: UmlOperation): void {
    if (!this.ensureCanEdit()) return;
    this.editingOperationId.set(operation.id);
    this.operationEditorClassId.set(operation.umlClassId);
    this.operationForm.reset({
      name: operation.name,
      visibility: operation.visibility as 'PUBLIC' | 'PRIVATE' | 'PROTECTED',
      returnType: this.returnTypeValue(operation.returnType),
    });
    this.resetOperationParameters(operation.parameters.map((parameter) => ({
      name: parameter.name,
      dataType: this.attributeTypeValue(parameter.dataType),
    })));
  }

  addOperationParameter(): void {
    if (this.operationParameters.length >= 10) {
      this.errorMessage.set('Una operación puede tener como máximo 10 parámetros.');
      return;
    }
    this.operationParameters.push(this.createOperationParameterForm());
  }

  removeOperationParameter(index: number): void {
    this.operationParameters.removeAt(index);
  }

  saveOperation(): void {
    if (!this.ensureCanEdit()) return;
    const classId = this.operationEditorClassId();
    const operationId = this.editingOperationId();
    const umlClass = classId ? this.classes().find((item) => item.id === classId) ?? null : null;
    if (!umlClass || this.operationForm.invalid || this.operationParameters.invalid) {
      this.operationForm.markAllAsTouched();
      this.operationParameters.markAllAsTouched();
      return;
    }
    const request = { ...this.operationForm.getRawValue(), parameters: this.operationParameters.getRawValue() };
    this.isSubmitting.set(true);
    const saveRequest = operationId
      ? this.diagramApi.updateOperation(operationId, request)
      : this.diagramApi.createOperation(umlClass.id, request);
    saveRequest.subscribe({
      next: (operation) => {
        this.classes.update((classes) => classes.map((item) => item.id === umlClass.id
          ? { ...item, operations: operationId
            ? item.operations.map((existing) => existing.id === operation.id ? operation : existing)
            : [...item.operations, operation] }
          : item));
        this.closeOperationEditor();
        this.successMessage.set(operationId ? 'La operación fue actualizada.' : `La operación “${operation.name}” fue agregada.`);
        this.isSubmitting.set(false);
      },
      error: () => { this.errorMessage.set('No pudimos guardar la operación. Revisa sus datos e inténtalo nuevamente.'); this.isSubmitting.set(false); },
    });
  }

  closeOperationEditor(): void {
    this.operationEditorClassId.set(null);
    this.editingOperationId.set(null);
    this.operationForm.reset({ name: '', visibility: 'PUBLIC', returnType: 'VOID' });
    this.resetOperationParameters([]);
  }

  saveAttributeEdit(): void {
    if (!this.ensureCanEdit()) return;
    const umlClass = this.selectedClass();
    const attributeId = this.editingAttributeId();
    if (!umlClass || !attributeId || this.attributeEditForm.invalid) {
      this.attributeEditForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.diagramApi.updateAttribute(attributeId, this.attributeEditForm.getRawValue()).subscribe({
      next: (updatedAttribute) => {
        this.classes.update((classes) => classes.map((item) => item.id === umlClass.id
          ? {
              ...item,
              attributes: item.attributes.map((attribute) => attribute.id === updatedAttribute.id
                ? updatedAttribute
                : updatedAttribute.primaryKey ? { ...attribute, primaryKey: false } : attribute),
            }
          : item));
        this.editingAttributeId.set(null);
        this.successMessage.set('El atributo fue actualizado.');
        this.isSubmitting.set(false);
      },
      error: () => { this.errorMessage.set('No pudimos actualizar el atributo.'); this.isSubmitting.set(false); },
    });
  }

  onCanvasPointerMove(event: PointerEvent, canvas: HTMLElement): void {
    const point = this.pointFromEvent(event, canvas);
    if (this.editorMode() === 'draw') {
      this.extendDrawing(point);
      return;
    }
    if (this.editorMode() === 'erase' && this.isErasing) {
      this.eraseDrawingAt(point);
      return;
    }
    if (this.draggedRelationId) {
      const index = this.draggedAlignmentPointIndex ?? 0;
      this.relations.update((relations) => relations.map((relation) => {
        if (relation.id !== this.draggedRelationId) return relation;
        const alignmentPoints = this.alignmentPointsFor(relation);
        alignmentPoints[index] = point;
        return { ...relation, alignmentPoints, bendX: null, bendY: null };
      }));
      return;
    }
    if (this.editorMode() === 'place-class') {
      this.placementPreview.set(point);
      return;
    }
    if (this.editorMode() === 'create-relation' && this.relationSourceId()) {
      this.relationPointer.set(point);
      return;
    }
    this.dragClass(event, canvas);
  }

  onCanvasPointerDown(event: PointerEvent, canvas: HTMLElement): void {
    if (!this.canEdit()) return;
    if (this.editorMode() === 'draw') {
      this.capturePointer(canvas, event.pointerId);
      event.preventDefault();
      this.beginDrawing(this.pointFromEvent(event, canvas));
      return;
    }
    if (this.editorMode() === 'erase') {
      this.isErasing = true;
      this.eraseDrawingAt(this.pointFromEvent(event, canvas));
      return;
    }
    if (this.editorMode() === 'place-class') {
      this.createClassAt(this.pointFromEvent(event, canvas));
      return;
    }
    this.clearSelection();
  }

  onClassPointerDown(event: PointerEvent, umlClass: UmlClass, canvas: HTMLElement): void {
    if (!this.canEdit()) {
      this.selectClass(umlClass);
      return;
    }
    if (this.editorMode() === 'draw') {
      event.stopPropagation();
      this.capturePointer(canvas, event.pointerId);
      event.preventDefault();
      this.beginDrawing(this.pointFromEvent(event, canvas));
      return;
    }
    if (this.editorMode() === 'create-relation') {
      this.startRelationDrag(event, umlClass, canvas);
      return;
    }
    this.closeInlineAttributeEditors();
    this.startDrag(event, umlClass, canvas);
  }

  onClassPointerUp(event: PointerEvent, umlClass: UmlClass): void {
    if (this.editorMode() !== 'create-relation' || !this.relationSourceId()) {
      return;
    }
    event.stopPropagation();
    this.completeRelationDrag(umlClass);
  }

  startDrag(event: PointerEvent, umlClass: UmlClass, canvas: HTMLElement): void {
    this.selectClass(umlClass);
    this.draggedClassId = umlClass.id;
    const point = this.pointFromEvent(event, canvas);
    this.dragOffsetX = point.x - umlClass.positionX;
    this.dragOffsetY = point.y - umlClass.positionY;
    this.collaboration.publishEphemeral('ELEMENT_INTERACTION', {
      elementId: umlClass.id, elementType: 'CLASS', state: 'DRAGGING',
    });
    this.capturePointer(event.currentTarget as HTMLElement, event.pointerId);
    event.preventDefault();
  }

  dragClass(event: PointerEvent, canvas: HTMLElement): void {
    if (!this.draggedClassId) {
      return;
    }
    const point = this.pointFromEvent(event, canvas);
    const positionX = Math.max(0, point.x - this.dragOffsetX);
    const positionY = Math.max(0, point.y - this.dragOffsetY);
    this.classes.update((classes) => classes.map((umlClass) =>
      umlClass.id === this.draggedClassId ? { ...umlClass, positionX, positionY } : umlClass,
    ));
  }

  cancelEditorAction(): void {
    this.editorMode.set('select');
    this.pendingClassName.set(null);
    this.placementPreview.set(null);
    this.relationSourceId.set(null);
    this.relationPointer.set(null);
    this.isCreatingAssociationClass.set(false);
    this.pendingAssociationClassName.set(null);
  }

  finishDrag(): void {
    if (!this.canEdit()) return;
    const draggedClass = this.classes().find((umlClass) => umlClass.id === this.draggedClassId);
    this.draggedClassId = null;
    if (draggedClass) {
      this.collaboration.publishEphemeral('ELEMENT_INTERACTION', {
        elementId: draggedClass.id, elementType: 'CLASS', state: 'IDLE',
      });
    }
    if (!draggedClass) {
      return;
    }
    this.diagramApi.updateClass(draggedClass.id, {
      name: draggedClass.name,
      positionX: draggedClass.positionX,
      positionY: draggedClass.positionY,
      fillColor: draggedClass.fillColor,
    }).subscribe({
      next: (updatedClass) => this.classes.update((classes) => classes.map((umlClass) =>
        umlClass.id === updatedClass.id ? updatedClass : umlClass,
      )),
      error: () => this.errorMessage.set('No pudimos guardar la nueva posición de la clase.'),
    });
  }

  onCanvasPointerUp(): void {
    if (this.editorMode() === 'draw') {
      this.finishDrawing();
      return;
    }
    if (this.editorMode() === 'erase') {
      this.isErasing = false;
      return;
    }
    this.finishRelationBendDrag();
    this.finishDrag();
  }

  toggleDrawingMode(): void {
    if (!this.ensureCanEdit()) return;
    if (this.editorMode() === 'draw') {
      this.editorMode.set('select');
      this.currentDrawing.set(null);
      this.collaboration.publishEphemeral('DRAWING_PREVIEW_CLEARED', null);
      return;
    }
    this.cancelEditorAction();
    this.editorMode.set('draw');
    this.successMessage.set('Lápiz activo: cada trazo se comparte al soltarlo.');
  }

  clearDrawings(): void {
    if (!this.ensureCanEdit()) return;
    this.currentDrawing.set(null);
    if (!this.diagramId || this.freehandPaths().length === 0) return;
    this.diagramApi.clearDrawings(this.diagramId).subscribe({
      next: () => {
        this.freehandPaths.set([]);
        this.successMessage.set('Los trazos compartidos fueron eliminados.');
      },
      error: () => this.errorMessage.set('No pudimos eliminar los trazos compartidos.'),
    });
  }

  toggleEraserMode(): void {
    if (!this.ensureCanEdit()) return;
    if (this.editorMode() === 'erase') {
      this.editorMode.set('select');
      return;
    }
    this.cancelEditorAction();
    this.editorMode.set('erase');
    this.successMessage.set('Borrador activo: arrástralo sobre un trazo para eliminarlo.');
  }

  zoomIn(): void { this.zoom.update((value) => Math.min(1.5, Number((value + 0.1).toFixed(1)))); }

  zoomOut(): void { this.zoom.update((value) => Math.max(0.5, Number((value - 0.1).toFixed(1)))); }

  zoomPercentage(): number { return Math.round(this.zoom() * 100); }

  applyClassColor(fillColor: string | null): void {
    if (!this.ensureCanEdit()) return;
    const umlClass = this.selectedClass();
    if (!umlClass) return;
    this.isSubmitting.set(true);
    this.diagramApi.updateClass(umlClass.id, {
      name: umlClass.name,
      positionX: umlClass.positionX,
      positionY: umlClass.positionY,
      fillColor,
    }).subscribe({
      next: (updatedClass) => {
        const classWithAttributes = { ...updatedClass, fillColor: updatedClass.fillColor ?? fillColor, attributes: umlClass.attributes, operations: updatedClass.operations ?? umlClass.operations };
        this.classes.update((classes) => classes.map((item) => item.id === updatedClass.id ? classWithAttributes : item));
        this.selectClass(classWithAttributes);
        this.successMessage.set('El color de la clase fue actualizado.');
        this.isSubmitting.set(false);
      },
      error: () => { this.errorMessage.set('No pudimos actualizar el color de la clase.'); this.isSubmitting.set(false); },
    });
  }

  openRelationLabelEditor(relation: UmlRelation): void {
    if (!this.ensureCanEdit()) return;
    this.selectRelation(relation);
    this.editingRelationLabelId.set(relation.id);
    this.relationLabelForm.reset({ label: relation.label ?? '' });
  }

  cancelRelationLabelEdit(): void { this.editingRelationLabelId.set(null); }

  saveRelationLabel(relation: UmlRelation): void {
    if (!this.ensureCanEdit()) return;
    const label = this.relationLabelForm.controls.label.value.trim();
    this.isSubmitting.set(true);
    this.diagramApi.updateRelation(relation.id, {
      sourceClassId: relation.sourceClassId,
      targetClassId: relation.targetClassId,
      type: relation.type,
      label: label || null,
      sourceCardinality: relation.sourceCardinality,
      targetCardinality: relation.targetCardinality,
      bendX: relation.bendX,
      bendY: relation.bendY,
      associationClassId: relation.associationClassId ?? null,
      alignmentPoints: relation.alignmentPoints ?? [],
    }).subscribe({
      next: (updatedRelation) => {
        const relationWithLabel = { ...updatedRelation, label: (updatedRelation.label ?? label) || null };
        this.relations.update((relations) => relations.map((item) => item.id === updatedRelation.id ? relationWithLabel : item));
        this.editingRelationLabelId.set(null);
        this.successMessage.set('La palabra de enlace fue actualizada.');
        this.isSubmitting.set(false);
      },
      error: () => { this.errorMessage.set('No pudimos actualizar la palabra de enlace.'); this.isSubmitting.set(false); },
    });
  }

  openCanvasCardinalityEditor(relation: UmlRelation, endpoint: CardinalityEndpoint): void {
    if (!this.ensureCanEdit()) return;
    const value = endpoint === 'source' ? relation.sourceCardinality : relation.targetCardinality;
    if (!value) return;
    this.selectRelation(relation);
    this.editingCanvasCardinality.set({ relationId: relation.id, endpoint });
    this.canvasCardinalityForm.reset({ value });
  }

  isEditingCanvasCardinality(relationId: string, endpoint: CardinalityEndpoint): boolean {
    const editing = this.editingCanvasCardinality();
    return editing?.relationId === relationId && editing.endpoint === endpoint;
  }

  saveCanvasCardinality(relation: UmlRelation, endpoint: CardinalityEndpoint): void {
    if (!this.ensureCanEdit()) return;
    const value = this.canvasCardinalityForm.controls.value.value;
    const sourceCardinality = endpoint === 'source' ? value : relation.sourceCardinality;
    const targetCardinality = endpoint === 'target' ? value : relation.targetCardinality;
    if (!sourceCardinality || !targetCardinality) return;
    this.isSubmitting.set(true);
    this.diagramApi.updateRelationCardinality(relation.id, { sourceCardinality, targetCardinality }).subscribe({
      next: (updatedRelation) => {
        this.relations.update((relations) => relations.map((item) => item.id === updatedRelation.id ? updatedRelation : item));
        this.editingCanvasCardinality.set(null);
        this.successMessage.set('La cardinalidad fue actualizada.');
        this.isSubmitting.set(false);
      },
      error: () => {
        this.errorMessage.set('No pudimos actualizar la cardinalidad. Verifica que sea una asociación, agregación o composición.');
        this.isSubmitting.set(false);
      },
    });
  }

  classColorToken(fillColor: string | null): string {
    return ({
      '#EAF3FF': 'blue', '#FFFFFF': 'white', '#FFF3CD': 'yellow', '#E7F7ED': 'green', '#FCE8E8': 'pink',
    })[fillColor ?? '#FFFFFF'] ?? 'white';
  }

  dismissSuccess(): void { this.successMessage.set(''); }

  dismissError(): void { this.errorMessage.set(''); }

  collaborationStatusLabel(): string {
    return {
      connecting: 'Conectando colaboración…',
      connected: 'Colaboración conectada',
      reconnecting: 'Reconectando colaboración…',
      error: 'Colaboración no disponible',
      disconnected: 'Colaboración desconectada',
    }[this.collaborationState()];
  }

  handleCollaborationEvent(event: DiagramEvent): void {
    const actor = event.actor;
    if (event.diagramId !== this.diagramId || !actor || actor.userId === this.authSession.user()?.userId) return;
    if (event.type === 'DRAWING_PREVIEW') {
      const svgPath = this.stringPayload(event.payload, 'svgPath');
      if (svgPath) this.remoteDrawingPreviews.update((previews) => [
        ...previews.filter((preview) => preview.userId !== actor.userId),
        { userId: actor.userId, name: actor.name, svgPath },
      ]);
      return;
    }
    if (event.type === 'DRAWING_PREVIEW_CLEARED') {
      this.clearRemoteDrawingPreview(actor.userId);
      return;
    }
    if (event.type === 'ELEMENT_INTERACTION') {
      this.updateRemoteClassInteraction(actor.userId, actor.name, event.payload);
      return;
    }
    if (event.type !== 'DIAGRAM_CHANGED') return;
    this.clearRemoteDrawingPreview(actor.userId);
    this.loadDiagram();
    this.addCollaborationActivity(actor.name, typeof event.payload === 'string' ? event.payload : 'actualizó el diagrama');
  }

  remoteClassColor(classId: string): string | null {
    const interaction = this.remoteClassInteractions().find((item) => item.classId === classId);
    return interaction ? this.collaborationColor(interaction.userId) : null;
  }

  isClassInteractedRemotely(classId: string): boolean {
    return this.remoteClassInteractions().some((item) => item.classId === classId);
  }

  private handleDiagramConflict(error: unknown, fallbackMessage: string): void {
    if (isVersionConflict(error)) {
      this.loadDiagram();
      this.closeEditDiagramDialog();
      this.cancelDiagramDeletion();
      this.errorMessage.set('El diagrama cambió en otra sesión. Recargamos sus datos antes de permitir otro cambio.');
      return;
    }
    this.errorMessage.set(fallbackMessage);
  }

  private loadProjectRole(projectId: string): void {
    this.projectApi.findMembers(projectId).subscribe({
      next: (members) => {
        const currentUserId = this.authSession.user()?.userId;
        this.projectRole.set(members.find((member) => member.userId === currentUserId)?.role ?? null);
      },
      error: () => this.projectRole.set(null),
    });
  }

  private ensureCanEdit(): boolean {
    if (this.canEdit()) return true;
    this.errorMessage.set('Este proyecto es de solo lectura para tu cuenta.');
    return false;
  }

  relationGeometry(relation: UmlRelation): RelationGeometry | null {
    const source = this.classes().find((umlClass) => umlClass.id === relation.sourceClassId);
    const target = this.classes().find((umlClass) => umlClass.id === relation.targetClassId);
    if (!source || !target) {
      return null;
    }
    if (source.id === target.id) {
      return this.selfRelationGeometry(source);
    }
    const sourceCenter = { x: source.positionX + 100, y: source.positionY + this.umlClassHeight(source) / 2 };
    const targetCenter = { x: target.positionX + 100, y: target.positionY + this.umlClassHeight(target) / 2 };
    const alignmentPoints = this.alignmentPointsFor(relation);
    const sourceToward = alignmentPoints[0] ?? targetCenter;
    const targetToward = alignmentPoints.at(-1) ?? sourceCenter;
    const sourcePoint = this.edgePoint(source, sourceCenter, sourceToward);
    const targetPoint = this.edgePoint(target, targetCenter, targetToward);
    const sourceDirection = this.direction(sourcePoint, sourceToward);
    const targetDirection = this.direction(targetPoint, targetToward);
    const defaultCenter = { x: (sourceCenter.x + targetCenter.x) / 2, y: (sourceCenter.y + targetCenter.y) / 2 };
    const labelPoint = alignmentPoints.at(Math.floor(alignmentPoints.length / 2)) ?? defaultCenter;
    const points = [sourcePoint, ...alignmentPoints, targetPoint].map((point) => `${point.x},${point.y}`).join(' ');
    return { x1: sourcePoint.x, y1: sourcePoint.y, x2: targetPoint.x, y2: targetPoint.y, points, alignmentPoints, sourceLabelX: sourcePoint.x + sourceDirection.x * 34, sourceLabelY: sourcePoint.y + sourceDirection.y * 34, targetLabelX: targetPoint.x + targetDirection.x * 34, targetLabelY: targetPoint.y + targetDirection.y * 34, labelX: labelPoint.x, labelY: labelPoint.y - 8 };
  }

  relationMarkerEnd(type: RelationType): string | null {
    if (type === 'GENERALIZATION' || type === 'REALIZATION') {
      return 'url(#generalization)';
    }
    return type === 'DEPENDENCY' ? 'url(#dependency)' : null;
  }

  relationMarkerStart(type: RelationType): string | null {
    if (type === 'AGGREGATION') {
      return 'url(#aggregation)';
    }
    return type === 'COMPOSITION' ? 'url(#composition)' : null;
  }

  activateRelationTool(type: RelationType, createsAssociationClass = false): void {
    if (!this.ensureCanEdit()) return;
    if (createsAssociationClass) {
      this.openAssociationClassDialog();
      return;
    }
    if (this.classes().length === 0) {
      this.errorMessage.set('Crea una clase antes de establecer una relación.');
      return;
    }
    this.relationForm.reset({
      type,
      label: '',
      sourceCardinality: '1..1',
      targetCardinality: '1..1',
    });
    this.editorMode.set('create-relation');
    this.isCreatingAssociationClass.set(false);
    this.relationSourceId.set(null);
    this.relationPointer.set(null);
    this.successMessage.set('Arrastra desde la clase de origen hasta la clase de destino.');
  }

  relationUsesCardinality(): boolean {
    return this.relationSupportsCardinality(this.relationForm.controls.type.value);
  }

  relationSupportsCardinality(type: RelationType): boolean {
    return type === 'ASSOCIATION' || type === 'AGGREGATION' || type === 'COMPOSITION';
  }

  relationSupportsLabel(type: RelationType): boolean {
    return type === 'ASSOCIATION' || type === 'AGGREGATION' || type === 'COMPOSITION' || type === 'DEPENDENCY';
  }

  private hasInvalidRelationEndpoints(sourceClassId: string, targetClassId: string, type: RelationType, associationClassId: string | null): boolean {
    return sourceClassId === targetClassId && (!!associationClassId || type === 'GENERALIZATION' || type === 'REALIZATION' || type === 'DEPENDENCY');
  }

  private relationEndpointError(sourceClassId: string, targetClassId: string, type: RelationType, associationClassId: string | null): string {
    if (sourceClassId === targetClassId && !!associationClassId) return 'La clase intermedia requiere dos clases diferentes.';
    if (sourceClassId === targetClassId && (type === 'GENERALIZATION' || type === 'REALIZATION' || type === 'DEPENDENCY')) return 'Este tipo de relación requiere dos clases diferentes.';
    return 'Completa los datos de la relación.';
  }

  private wouldCreateGeneralizationCycle(relationId: string | null, sourceClassId: string, targetClassId: string, type: RelationType): boolean {
    if (type !== 'GENERALIZATION') return false;
    const pending = [targetClassId];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const current = pending.shift()!;
      if (current === sourceClassId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      this.relations()
        .filter((relation) => relation.id !== relationId && relation.type === 'GENERALIZATION' && relation.sourceClassId === current)
        .forEach((relation) => pending.push(relation.targetClassId));
    }
    return false;
  }

  associationClass(relation: UmlRelation): UmlClass | null {
    if (!relation.associationClassId) return null;
    return this.classes().find((umlClass) => umlClass.id === relation.associationClassId) ?? null;
  }

  saveRelation(): void {
    if (!this.ensureCanEdit()) return;
    const relation = this.selectedRelation();
    const request = this.relationEditForm.getRawValue();
    if (!relation || this.relationEditForm.invalid || this.hasInvalidRelationEndpoints(request.sourceClassId, request.targetClassId, request.type, request.associationClassId)) {
      this.relationEditForm.markAllAsTouched();
      this.errorMessage.set(this.relationEndpointError(request.sourceClassId, request.targetClassId, request.type, request.associationClassId));
      return;
    }
    if (this.wouldCreateGeneralizationCycle(relation.id, request.sourceClassId, request.targetClassId, request.type)) {
      this.errorMessage.set('La generalización no puede crear un ciclo de herencia.');
      return;
    }
    const supportsCardinality = this.relationSupportsCardinality(request.type);
    if (supportsCardinality && (!request.sourceCardinality || !request.targetCardinality)) {
      this.errorMessage.set('Esta relación requiere cardinalidad en ambos extremos.');
      return;
    }
    this.isSubmitting.set(true);
    const associationClassId = request.type === 'ASSOCIATION' && request.associationClassId
      ? request.associationClassId
      : null;
    this.diagramApi.updateRelation(relation.id, {
      ...request,
      label: this.relationSupportsLabel(request.type) ? request.label || null : null,
      sourceCardinality: associationClassId ? '1..*' : supportsCardinality ? request.sourceCardinality : null,
      targetCardinality: associationClassId ? '1..*' : supportsCardinality ? request.targetCardinality : null,
      bendX: relation.bendX,
      bendY: relation.bendY,
      associationClassId,
      alignmentPoints: relation.alignmentPoints ?? [],
    }).subscribe({
      next: (updatedRelation) => {
        this.relations.update((relations) => relations.map((item) => item.id === updatedRelation.id ? updatedRelation : item));
        this.selectRelation(updatedRelation);
        this.successMessage.set('La relación fue actualizada.');
        this.isSubmitting.set(false);
      },
      error: () => { this.errorMessage.set('No pudimos actualizar la relación.'); this.isSubmitting.set(false); },
    });
  }

  requestDelete(target: DeleteTarget): void {
    if (!this.ensureCanEdit()) return;
    this.deleteTarget.set(target);
  }

  cancelDelete(): void { this.deleteTarget.set(null); }

  confirmDelete(): void {
    if (!this.ensureCanEdit()) return;
    const target = this.deleteTarget();
    if (!target) return;
    this.isSubmitting.set(true);
    const onSuccess = (): void => {
      if (target.kind === 'class') {
        this.classes.update((classes) => classes.filter((item) => item.id !== target.id));
        this.relations.update((relations) => relations.filter((item) => item.sourceClassId !== target.id && item.targetClassId !== target.id));
        this.selectedClassId.set(null);
      } else if (target.kind === 'attribute') {
        this.classes.update((classes) => classes.map((item) => ({ ...item, attributes: item.attributes.filter((attribute) => attribute.id !== target.id) })));
        this.editingAttributeId.set(null);
      } else if (target.kind === 'operation') {
        this.classes.update((classes) => classes.map((item) => ({ ...item, operations: item.operations.filter((operation) => operation.id !== target.id) })));
        this.editingOperationId.set(null);
      } else {
        this.relations.update((relations) => relations.filter((item) => item.id !== target.id));
        this.selectedRelationId.set(null);
      }
      this.state.set(this.classes().length === 0 ? 'empty' : 'ready');
      this.deleteTarget.set(null);
      this.successMessage.set(`${target.label} fue eliminado.`);
      this.isSubmitting.set(false);
    };
    const onError = (): void => { this.errorMessage.set(`No pudimos eliminar ${target.label.toLowerCase()}.`); this.isSubmitting.set(false); };
    if (target.kind === 'class') this.diagramApi.deleteClass(target.id).subscribe({ next: onSuccess, error: onError });
    else if (target.kind === 'attribute') this.diagramApi.deleteAttribute(target.id).subscribe({ next: onSuccess, error: onError });
    else if (target.kind === 'operation') this.diagramApi.deleteOperation(target.id).subscribe({ next: onSuccess, error: onError });
    else this.diagramApi.deleteRelation(target.id).subscribe({ next: onSuccess, error: onError });
  }

  relationPreviewGeometry(): { x1: number; y1: number; x2: number; y2: number } | null {
    const sourceId = this.relationSourceId();
    const pointer = this.relationPointer();
    const source = sourceId ? this.classes().find((umlClass) => umlClass.id === sourceId) : null;
    return source && pointer
      ? { x1: source.positionX + 100, y1: source.positionY + 35, x2: pointer.x, y2: pointer.y }
      : null;
  }

  attributeVisibilitySymbol(visibility: string): string {
    return visibility === 'PUBLIC' ? '+' : visibility === 'PROTECTED' ? '#' : '-';
  }

  private createClassAt(position: CanvasPoint): void {
    const name = this.pendingClassName();
    if (!this.diagramId || !name) {
      return;
    }
    this.isSubmitting.set(true);
    this.diagramApi.createClass(this.diagramId, { name, positionX: position.x, positionY: position.y, fillColor: '#EAF3FF' }).subscribe({
      next: (umlClass) => {
        this.classes.update((classes) => [...classes, umlClass]);
        this.state.set('ready');
        this.selectedClassId.set(umlClass.id);
        this.successMessage.set(`La clase “${umlClass.name}” fue creada correctamente.`);
        this.isSubmitting.set(false);
        this.cancelEditorAction();
      },
      error: () => {
        this.errorMessage.set('No pudimos crear la clase. Revisa el nombre e inténtalo nuevamente.');
        this.isSubmitting.set(false);
      },
    });
  }

  private startRelationDrag(event: PointerEvent, umlClass: UmlClass, canvas: HTMLElement): void {
    event.preventDefault();
    this.selectClass(umlClass);
    this.relationSourceId.set(umlClass.id);
    this.relationPointer.set(this.pointFromEvent(event, canvas));
  }

  private completeRelationDrag(targetClass: UmlClass): void {
    const sourceClassId = this.relationSourceId();
    if (!this.diagramId || !sourceClassId) {
      this.errorMessage.set('Selecciona una clase de origen y una clase de destino.');
      this.cancelEditorAction();
      return;
    }
    const request = this.relationForm.getRawValue();
    if (this.isCreatingAssociationClass()) {
      if (sourceClassId === targetClass.id) {
        this.errorMessage.set('La clase intermedia requiere dos clases diferentes.');
        this.cancelEditorAction();
        return;
      }
      this.isSubmitting.set(true);
      const sourceClass = this.classes().find((umlClass) => umlClass.id === sourceClassId);
      const name = this.pendingAssociationClassName();
      if (!sourceClass || !name) {
        this.errorMessage.set('No pudimos preparar la clase intermedia. Inténtalo nuevamente.');
        this.isSubmitting.set(false);
        this.cancelEditorAction();
        return;
      }
      this.diagramApi.createAssociationClass(this.diagramId, {
        sourceClassId,
        targetClassId: targetClass.id,
        name,
        positionX: (sourceClass.positionX + targetClass.positionX) / 2,
        positionY: Math.max(0, (sourceClass.positionY + targetClass.positionY) / 2 - 52),
        fillColor: '#EAF3FF',
        label: null,
      }).subscribe({
        next: (response) => {
          this.classes.update((classes) => [...classes, response.umlClass]);
          this.relations.update((relations) => [...relations, response.relation]);
          this.state.set('ready');
          this.selectClass(response.umlClass);
          this.successMessage.set(`La clase intermedia “${response.umlClass.name}” fue creada correctamente.`);
          this.isSubmitting.set(false);
          this.cancelEditorAction();
        },
        error: () => {
          this.errorMessage.set('No pudimos crear la clase intermedia y su asociación. Inténtalo nuevamente.');
          this.isSubmitting.set(false);
        },
      });
      return;
    }
    if (this.hasInvalidRelationEndpoints(sourceClassId, targetClass.id, request.type, null)) {
      this.errorMessage.set(this.relationEndpointError(sourceClassId, targetClass.id, request.type, null));
      this.cancelEditorAction();
      return;
    }
    if (this.wouldCreateGeneralizationCycle(null, sourceClassId, targetClass.id, request.type)) {
      this.errorMessage.set('La generalización no puede crear un ciclo de herencia.');
      this.cancelEditorAction();
      return;
    }
    this.isSubmitting.set(true);
    this.diagramApi.createRelation(this.diagramId, {
      sourceClassId,
      targetClassId: targetClass.id,
      type: request.type,
      label: this.relationSupportsLabel(request.type) ? request.label || null : null,
      sourceCardinality: this.relationUsesCardinality() ? request.sourceCardinality : null,
      targetCardinality: this.relationUsesCardinality() ? request.targetCardinality : null,
      bendX: null,
      bendY: null,
      associationClassId: null,
      alignmentPoints: [],
    }).subscribe({
      next: (relation) => {
        this.relations.update((relations) => [...relations, relation]);
        this.successMessage.set(`${this.relationLabel(relation.type)} creada correctamente.`);
        this.isSubmitting.set(false);
        this.cancelEditorAction();
      },
      error: () => {
        this.errorMessage.set('No pudimos crear la relación. Revisa sus clases y cardinalidades.');
        this.isSubmitting.set(false);
      },
    });
  }

  relationLabel(type: RelationType): string {
    return ({ ASSOCIATION: 'Asociación', AGGREGATION: 'Agregación', COMPOSITION: 'Composición', GENERALIZATION: 'Generalización / herencia', REALIZATION: 'Realización', DEPENDENCY: 'Dependencia' })[type];
  }

  activityTimestamp(value: string): string {
    return new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  }

  private selfRelationGeometry(umlClass: UmlClass): RelationGeometry {
    const right = umlClass.positionX + 200;
    const top = umlClass.positionY;
    const height = this.umlClassHeight(umlClass);
    const sourcePoint = { x: right, y: top + Math.min(30, height * 0.3) };
    const targetPoint = { x: right, y: top + Math.max(height - 30, height * 0.7) };
    const outerX = right + 58;
    const labelY = top + height / 2;
    const points = [sourcePoint, { x: outerX, y: sourcePoint.y }, { x: outerX, y: targetPoint.y }, targetPoint]
      .map((point) => `${point.x},${point.y}`).join(' ');
    return {
      x1: sourcePoint.x,
      y1: sourcePoint.y,
      x2: targetPoint.x,
      y2: targetPoint.y,
      points,
      alignmentPoints: [],
      sourceLabelX: outerX + 18,
      sourceLabelY: sourcePoint.y + 3,
      targetLabelX: outerX + 18,
      targetLabelY: targetPoint.y + 3,
      labelX: outerX + 9,
      labelY: labelY - 8,
    };
  }

  private pointFromEvent(event: PointerEvent, canvas: HTMLElement): CanvasPoint {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, (event.clientX - bounds.left + canvas.scrollLeft) / this.zoom()),
      y: Math.max(0, (event.clientY - bounds.top + canvas.scrollTop) / this.zoom()),
    };
  }

  private capturePointer(element: Element, pointerId: number): void {
    if ('setPointerCapture' in element && typeof element.setPointerCapture === 'function') {
      element.setPointerCapture(pointerId);
    }
  }

  private beginDrawing(point: CanvasPoint): void {
    const drawing = `M ${point.x} ${point.y}`;
    this.currentDrawing.set(drawing);
    this.publishDrawingPreview(drawing, true);
  }

  private extendDrawing(point: CanvasPoint): void {
    const current = this.currentDrawing();
    if (current) {
      const drawing = `${current} L ${point.x} ${point.y}`;
      this.currentDrawing.set(drawing);
      this.publishDrawingPreview(drawing);
    }
  }

  private finishDrawing(): void {
    const current = this.currentDrawing();
    this.currentDrawing.set(null);
    if (!current || !this.diagramId) return;
    this.diagramApi.createDrawing(this.diagramId, current).subscribe({
      next: (drawing) => {
        this.freehandPaths.update((drawings) => [...drawings, drawing]);
        this.collaboration.publishEphemeral('DRAWING_PREVIEW_CLEARED', null);
      },
      error: () => {
        this.collaboration.publishEphemeral('DRAWING_PREVIEW_CLEARED', null);
        this.errorMessage.set('No pudimos compartir este trazo. Inténtalo nuevamente.');
      },
    });
  }

  private publishDrawingPreview(svgPath: string, force = false): void {
    const now = Date.now();
    if (!force && now - this.lastDrawingPreviewAt < 50) return;
    this.lastDrawingPreviewAt = now;
    this.collaboration.publishEphemeral('DRAWING_PREVIEW', { svgPath });
  }

  private clearRemoteDrawingPreview(userId: string): void {
    this.remoteDrawingPreviews.update((previews) => previews.filter((preview) => preview.userId !== userId));
  }

  private updateRemoteClassInteraction(userId: string, name: string, payload: unknown): void {
    const classId = this.stringPayload(payload, 'elementId');
    const state = this.stringPayload(payload, 'state');
    if (!classId || !state) return;
    this.clearRemoteInteractionTimeout(userId);
    if (state === 'IDLE') {
      this.remoteClassInteractions.update((items) => items.filter((item) => item.userId !== userId));
      return;
    }
    if (state !== 'DRAGGING') return;
    this.remoteClassInteractions.update((items) => [
      ...items.filter((item) => item.userId !== userId),
      { userId, name, classId },
    ]);
    this.remoteInteractionTimeouts.set(userId, setTimeout(() => {
      this.remoteClassInteractions.update((items) => items.filter((item) => item.userId !== userId));
      this.remoteInteractionTimeouts.delete(userId);
    }, 4_000));
  }

  private clearRemoteInteractionTimeout(userId: string): void {
    const timeout = this.remoteInteractionTimeouts.get(userId);
    if (timeout) clearTimeout(timeout);
    this.remoteInteractionTimeouts.delete(userId);
  }

  private addCollaborationActivity(name: string, action: string): void {
    const id = `${name}-${Date.now()}`;
    this.collaborationActivity.update((items) => [{ id, name, action }, ...items].slice(0, 3));
    this.activityTimeouts.set(id, setTimeout(() => {
      this.collaborationActivity.update((items) => items.filter((item) => item.id !== id));
      this.activityTimeouts.delete(id);
    }, 6_000));
  }

  private stringPayload(payload: unknown, key: string): string | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const value = (payload as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
  }

  private fileNameFrom(name: string): string {
    return name.trim().replaceAll(/[^a-zA-Z0-9-_]+/g, '-').replaceAll(/^-+|-+$/g, '') || 'diagrama-uml';
  }

  private collaborationColor(userId: string): string {
    const colors = ['#7c3aed', '#db2777', '#d97706', '#0891b2', '#16a34a'];
    const index = [...userId].reduce((total, character) => total + character.charCodeAt(0), 0) % colors.length;
    return colors[index];
  }

  private clearSelection(): void {
    this.selectedClassId.set(null);
    this.selectedRelationId.set(null);
    this.closeInlineAttributeEditors();
  }

  private closeInlineAttributeEditors(): void {
    this.attributeEditorClassId.set(null);
    this.editingAttributeId.set(null);
    this.closeOperationEditor();
  }

  operationDeclaration(operation: UmlOperation): string {
    const parameters = operation.parameters.map((parameter) => `${parameter.name}: ${parameter.dataType}`).join(', ');
    return `${this.attributeVisibilitySymbol(operation.visibility)} ${operation.name}(${parameters}): ${operation.returnType}`;
  }

  private createOperationParameterForm() {
    return this.formBuilder.nonNullable.group({
      name: ['', [Validators.required, Validators.maxLength(120)]],
      dataType: ['STRING' as AttributeDataType, Validators.required],
    });
  }

  private resetOperationParameters(parameters: { name: string; dataType: AttributeDataType }[]): void {
    this.operationParameters.clear();
    parameters.forEach((parameter) => this.operationParameters.push(this.createOperationParameterForm()));
    this.operationParameters.controls.forEach((control, index) => control.reset(parameters[index]));
  }

  private attributeTypeValue(displayName: string): AttributeDataType {
    return this.attributeTypes.find((item) => item.label === displayName)?.value ?? 'STRING';
  }

  private returnTypeValue(displayName: string): OperationReturnType {
    return displayName === 'void' ? 'VOID' : this.attributeTypeValue(displayName);
  }

  private eraseDrawingAt(point: CanvasPoint): void {
    const tolerance = 12 / this.zoom();
    const drawing = this.freehandPaths().find((item) => this.pathTouchesPoint(item.svgPath, point, tolerance));
    if (!drawing || !this.diagramId || this.deletingDrawingIds.has(drawing.id)) return;
    this.deletingDrawingIds.add(drawing.id);
    this.diagramApi.deleteDrawing(this.diagramId, drawing.id).subscribe({
      next: () => {
        this.freehandPaths.update((drawings) => drawings.filter((item) => item.id !== drawing.id));
        this.deletingDrawingIds.delete(drawing.id);
      },
      error: () => {
        this.deletingDrawingIds.delete(drawing.id);
        this.errorMessage.set('No pudimos eliminar este trazo compartido.');
      },
    });
  }

  private pathTouchesPoint(path: string, point: CanvasPoint, tolerance: number): boolean {
    const coordinates = [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    for (let index = 0; index + 3 < coordinates.length; index += 2) {
      if (this.distanceToSegment(point, { x: coordinates[index], y: coordinates[index + 1] }, { x: coordinates[index + 2], y: coordinates[index + 3] }) <= tolerance) return true;
    }
    return false;
  }

  private umlClassHeight(umlClass: UmlClass): number {
    const rendered = document.getElementById(`uml-class-${umlClass.id}`)?.offsetHeight;
    return rendered ? rendered / this.zoom() : 96 + umlClass.attributes.length * 22;
  }

  addAlignmentPoint(relation: UmlRelation): void {
    if (!this.ensureCanEdit()) return;
    const geometry = this.relationGeometry(relation);
    if (!geometry) return;
    const alignmentPoints = [...this.alignmentPointsFor(relation), { x: geometry.labelX, y: geometry.labelY + 8 }];
    this.relations.update((relations) => relations.map((item) => item.id === relation.id ? { ...item, alignmentPoints, bendX: null, bendY: null } : item));
    this.persistAlignmentPoints({ ...relation, alignmentPoints, bendX: null, bendY: null });
  }

  startRelationBendDrag(event: PointerEvent, relation: UmlRelation, index = 0): void {
    if (!this.ensureCanEdit()) return;
    event.stopPropagation();
    this.selectRelation(relation);
    this.draggedRelationId = relation.id;
    this.draggedAlignmentPointIndex = index;
    this.capturePointer(event.currentTarget as SVGElement, event.pointerId);
  }

  private finishRelationBendDrag(): void {
    const relation = this.relations().find((item) => item.id === this.draggedRelationId);
    this.draggedRelationId = null;
    this.draggedAlignmentPointIndex = null;
    if (!relation) return;
    this.persistAlignmentPoints(relation);
  }

  private persistAlignmentPoints(relation: UmlRelation): void {
    if (!this.canEdit()) return;
    this.diagramApi.updateRelation(relation.id, {
      sourceClassId: relation.sourceClassId, targetClassId: relation.targetClassId, type: relation.type,
      label: relation.label, sourceCardinality: relation.sourceCardinality, targetCardinality: relation.targetCardinality,
      bendX: relation.bendX, bendY: relation.bendY,
      associationClassId: relation.associationClassId ?? null,
      alignmentPoints: relation.alignmentPoints ?? [],
    }).subscribe({
      next: (updated) => this.relations.update((relations) => relations.map((item) => item.id === updated.id ? updated : item)),
      error: () => this.errorMessage.set('No pudimos guardar la posición visual de la relación.'),
    });
  }

  private alignmentPointsFor(relation: UmlRelation): RelationAlignmentPoint[] {
    if (relation.alignmentPoints?.length) return relation.alignmentPoints.map((point) => ({ ...point }));
    if (typeof relation.bendX === 'number' && typeof relation.bendY === 'number') return [{ x: relation.bendX, y: relation.bendY }];
    return [];
  }

  private edgePoint(umlClass: UmlClass, center: CanvasPoint, toward: CanvasPoint): CanvasPoint {
    const deltaX = toward.x - center.x;
    const deltaY = toward.y - center.y;
    const scale = 1 / Math.max(Math.abs(deltaX) / 100, Math.abs(deltaY) / (this.umlClassHeight(umlClass) / 2), 1);
    return { x: center.x + deltaX * scale, y: center.y + deltaY * scale };
  }

  private direction(from: CanvasPoint, to: CanvasPoint): CanvasPoint {
    const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance };
  }

  private distanceToSegment(point: CanvasPoint, start: CanvasPoint, end: CanvasPoint): number {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
    const projection = Math.max(0, Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared));
    return Math.hypot(point.x - (start.x + projection * deltaX), point.y - (start.y + projection * deltaY));
  }

}
