import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DiagramApiService } from '../data-access/diagram-api.service';
import { AttributeDataType, Diagram, RelationAlignmentPoint, RelationType, UmlClass, UmlRelation } from '../models/diagram.model';

type EditorState = 'loading' | 'empty' | 'ready' | 'error' | 'selection';
type EditorMode = 'select' | 'place-class' | 'create-relation' | 'draw' | 'erase';
type CanvasPoint = { x: number; y: number };
type RelationTool = { id: string; type: RelationType; label: string; hint: string; symbol: string; createsAssociationClass: boolean };
type DeleteTarget = { kind: 'class' | 'attribute' | 'relation'; id: string; label: string };
type CardinalityEndpoint = 'source' | 'target';
type CanvasCardinalityEdit = { relationId: string; endpoint: CardinalityEndpoint };
type RelationGeometry = { x1: number; y1: number; x2: number; y2: number; points: string; alignmentPoints: RelationAlignmentPoint[]; sourceLabelX: number; sourceLabelY: number; targetLabelX: number; targetLabelY: number; labelX: number; labelY: number };

@Component({
  selector: 'app-diagram-editor-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './diagram-editor-page.html',
  styleUrl: './diagram-editor-page.scss',
})
export class DiagramEditorPage {
  private readonly route = inject(ActivatedRoute);
  private readonly diagramApi = inject(DiagramApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly diagramId = this.route.snapshot.paramMap.get('diagramId');

  readonly state = signal<EditorState>('loading');
  readonly diagram = signal<Diagram | null>(null);
  readonly classes = signal<UmlClass[]>([]);
  readonly relations = signal<UmlRelation[]>([]);
  readonly selectedClassId = signal<string | null>(null);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly isCreateDialogOpen = signal(false);
  readonly isAssociationClassDialogOpen = signal(false);
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
  readonly deleteTarget = signal<DeleteTarget | null>(null);
  readonly freehandPaths = signal<string[]>([]);
  readonly currentDrawing = signal<string | null>(null);
  readonly zoom = signal(1);
  readonly editingRelationLabelId = signal<string | null>(null);
  readonly editingCanvasCardinality = signal<CanvasCardinalityEdit | null>(null);
  readonly canvasSize = computed(() => ({
    width: Math.max(1200, ...this.classes().map((umlClass) => umlClass.positionX + 260)),
    height: Math.max(620, ...this.classes().map((umlClass) => umlClass.positionY + this.umlClassHeight(umlClass) + 100)),
  }));
  readonly relationTools: readonly RelationTool[] = [
    { id: 'association', type: 'ASSOCIATION', label: 'Asociación', hint: 'Relación estructural', symbol: '—', createsAssociationClass: false },
    { id: 'association-class', type: 'ASSOCIATION', label: 'Clase intermedia', hint: 'Clase de asociación', symbol: '—□' , createsAssociationClass: true },
    { id: 'aggregation', type: 'AGGREGATION', label: 'Agregación', hint: 'Todo y partes', symbol: '◇—', createsAssociationClass: false },
    { id: 'composition', type: 'COMPOSITION', label: 'Composición', hint: 'Parte dependiente', symbol: '◆—', createsAssociationClass: false },
    { id: 'generalization', type: 'GENERALIZATION', label: 'Herencia', hint: 'Generalización', symbol: '—▷', createsAssociationClass: false },
    { id: 'realization', type: 'REALIZATION', label: 'Realización', hint: 'Implementa interfaz', symbol: '┄▷', createsAssociationClass: false },
    { id: 'dependency', type: 'DEPENDENCY', label: 'Dependencia', hint: 'Uso temporal', symbol: '┄→', createsAssociationClass: false },
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
  readonly associationClassForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });
  readonly attributeLineForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    dataType: ['STRING' as AttributeDataType, Validators.required],
    visibility: ['PRIVATE'],
  });
  readonly classEditForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });
  readonly attributeEditForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    dataType: ['STRING' as AttributeDataType, Validators.required],
    visibility: ['PRIVATE'],
  });
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

  constructor() {
    this.loadDiagram();
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
        this.state.set(details.classes.length === 0 ? 'empty' : 'ready');
      },
      error: () => {
        this.errorMessage.set('No pudimos cargar este diagrama. Inténtalo nuevamente.');
        this.state.set('error');
      },
    });
  }

  openCreateDialog(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
    this.isCreateDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    this.isCreateDialogOpen.set(false);
    this.createForm.reset();
  }

  openAssociationClassDialog(): void {
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
    const umlClass = this.selectedClass();
    if (!umlClass || this.classEditForm.invalid) {
      this.classEditForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const formValue = this.classEditForm.getRawValue();
    this.diagramApi.updateClass(umlClass.id, { name: formValue.name, fillColor: umlClass.fillColor, positionX: umlClass.positionX, positionY: umlClass.positionY }).subscribe({
      next: (updatedClass) => {
        const classWithAttributes = { ...updatedClass, fillColor: updatedClass.fillColor ?? umlClass.fillColor, attributes: umlClass.attributes };
        this.classes.update((classes) => classes.map((item) => item.id === updatedClass.id ? classWithAttributes : item));
        this.selectClass(classWithAttributes);
        this.successMessage.set('La clase fue actualizada.');
        this.isSubmitting.set(false);
      },
      error: () => { this.errorMessage.set('No pudimos actualizar la clase.'); this.isSubmitting.set(false); },
    });
  }

  addAttribute(): void {
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
            ? { ...umlClass, attributes: [...umlClass.attributes, createdAttribute] }
            : umlClass,
        ));
        this.successMessage.set(`El atributo “${createdAttribute.name}” fue agregado.`);
        this.isSubmitting.set(false);
        this.attributeLineForm.reset({ name: '', dataType: 'STRING', visibility: 'PRIVATE' });
      },
      error: () => {
        this.errorMessage.set('No pudimos agregar el atributo. Revisa los datos e inténtalo nuevamente.');
        this.isSubmitting.set(false);
      },
    });
  }

  openAttributeEditor(umlClass: UmlClass): void {
    this.selectClass(umlClass);
    this.attributeEditorClassId.set(umlClass.id);
    this.attributeLineForm.reset({ name: '', dataType: 'STRING', visibility: 'PRIVATE' });
  }

  closeAttributeEditor(): void {
    this.attributeEditorClassId.set(null);
    this.attributeLineForm.reset({ name: '', dataType: 'STRING', visibility: 'PRIVATE' });
  }

  startAttributeEdit(attribute: { id: string; name: string; dataType: string; visibility: string }): void {
    this.editingAttributeId.set(attribute.id);
    const type = this.attributeTypes.find((item) => item.label === attribute.dataType)?.value ?? 'STRING';
    this.attributeEditForm.reset({ name: attribute.name, dataType: type, visibility: attribute.visibility });
  }

  saveAttributeEdit(): void {
    const umlClass = this.selectedClass();
    const attributeId = this.editingAttributeId();
    if (!umlClass || !attributeId || this.attributeEditForm.invalid) {
      this.attributeEditForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.diagramApi.updateAttribute(attributeId, this.attributeEditForm.getRawValue()).subscribe({
      next: (updatedAttribute) => {
        this.classes.update((classes) => classes.map((item) => item.id === umlClass.id ? { ...item, attributes: item.attributes.map((attribute) => attribute.id === updatedAttribute.id ? updatedAttribute : attribute) } : item));
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
    if (this.editorMode() === 'draw') {
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
    if (this.editorMode() === 'draw') {
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
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
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
    const draggedClass = this.classes().find((umlClass) => umlClass.id === this.draggedClassId);
    this.draggedClassId = null;
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
    if (this.editorMode() === 'draw') {
      this.editorMode.set('select');
      this.currentDrawing.set(null);
      return;
    }
    this.cancelEditorAction();
    this.editorMode.set('draw');
    this.successMessage.set('Lápiz activo: dibuja libremente en el lienzo. Los trazos son temporales.');
  }

  clearDrawings(): void {
    this.freehandPaths.set([]);
    this.currentDrawing.set(null);
    this.successMessage.set('Los trazos temporales fueron limpiados.');
  }

  toggleEraserMode(): void {
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
        const classWithAttributes = { ...updatedClass, fillColor: updatedClass.fillColor ?? fillColor, attributes: umlClass.attributes };
        this.classes.update((classes) => classes.map((item) => item.id === updatedClass.id ? classWithAttributes : item));
        this.selectClass(classWithAttributes);
        this.successMessage.set('El color de la clase fue actualizado.');
        this.isSubmitting.set(false);
      },
      error: () => { this.errorMessage.set('No pudimos actualizar el color de la clase.'); this.isSubmitting.set(false); },
    });
  }

  openRelationLabelEditor(relation: UmlRelation): void {
    this.selectRelation(relation);
    this.editingRelationLabelId.set(relation.id);
    this.relationLabelForm.reset({ label: relation.label ?? '' });
  }

  cancelRelationLabelEdit(): void { this.editingRelationLabelId.set(null); }

  saveRelationLabel(relation: UmlRelation): void {
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

  relationGeometry(relation: UmlRelation): RelationGeometry | null {
    const source = this.classes().find((umlClass) => umlClass.id === relation.sourceClassId);
    const target = this.classes().find((umlClass) => umlClass.id === relation.targetClassId);
    if (!source || !target) {
      return null;
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
    if (createsAssociationClass) {
      this.openAssociationClassDialog();
      return;
    }
    if (this.classes().length < 2) {
      this.errorMessage.set('Crea al menos dos clases antes de establecer una relación.');
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

  associationClass(relation: UmlRelation): UmlClass | null {
    if (!relation.associationClassId) return null;
    return this.classes().find((umlClass) => umlClass.id === relation.associationClassId) ?? null;
  }

  saveRelation(): void {
    const relation = this.selectedRelation();
    const request = this.relationEditForm.getRawValue();
    if (!relation || this.relationEditForm.invalid || request.sourceClassId === request.targetClassId) {
      this.relationEditForm.markAllAsTouched();
      this.errorMessage.set('Selecciona dos clases diferentes y completa los datos de la relación.');
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
      sourceCardinality: supportsCardinality ? request.sourceCardinality : null,
      targetCardinality: supportsCardinality ? request.targetCardinality : null,
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

  requestDelete(target: DeleteTarget): void { this.deleteTarget.set(target); }

  cancelDelete(): void { this.deleteTarget.set(null); }

  confirmDelete(): void {
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
    if (!this.diagramId || !sourceClassId || sourceClassId === targetClass.id) {
      this.errorMessage.set('Arrastra la relación hasta una clase distinta de la clase de origen.');
      this.cancelEditorAction();
      return;
    }
    const request = this.relationForm.getRawValue();
    this.isSubmitting.set(true);
    if (this.isCreatingAssociationClass()) {
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

  private pointFromEvent(event: PointerEvent, canvas: HTMLElement): CanvasPoint {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, (event.clientX - bounds.left) / this.zoom()),
      y: Math.max(0, (event.clientY - bounds.top) / this.zoom()),
    };
  }

  private beginDrawing(point: CanvasPoint): void {
    this.currentDrawing.set(`M ${point.x} ${point.y}`);
  }

  private extendDrawing(point: CanvasPoint): void {
    const current = this.currentDrawing();
    if (current) this.currentDrawing.set(`${current} L ${point.x} ${point.y}`);
  }

  private finishDrawing(): void {
    const current = this.currentDrawing();
    if (current) this.freehandPaths.update((paths) => [...paths, current]);
    this.currentDrawing.set(null);
  }

  private clearSelection(): void {
    this.selectedClassId.set(null);
    this.selectedRelationId.set(null);
    this.closeInlineAttributeEditors();
  }

  private closeInlineAttributeEditors(): void {
    this.attributeEditorClassId.set(null);
    this.editingAttributeId.set(null);
  }

  private eraseDrawingAt(point: CanvasPoint): void {
    const tolerance = 12 / this.zoom();
    this.freehandPaths.update((paths) => paths.filter((path) => !this.pathTouchesPoint(path, point, tolerance)));
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
    const geometry = this.relationGeometry(relation);
    if (!geometry) return;
    const alignmentPoints = [...this.alignmentPointsFor(relation), { x: geometry.labelX, y: geometry.labelY + 8 }];
    this.relations.update((relations) => relations.map((item) => item.id === relation.id ? { ...item, alignmentPoints, bendX: null, bendY: null } : item));
    this.persistAlignmentPoints({ ...relation, alignmentPoints, bendX: null, bendY: null });
  }

  startRelationBendDrag(event: PointerEvent, relation: UmlRelation, index = 0): void {
    event.stopPropagation();
    this.selectRelation(relation);
    this.draggedRelationId = relation.id;
    this.draggedAlignmentPointIndex = index;
    (event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
  }

  private finishRelationBendDrag(): void {
    const relation = this.relations().find((item) => item.id === this.draggedRelationId);
    this.draggedRelationId = null;
    this.draggedAlignmentPointIndex = null;
    if (!relation) return;
    this.persistAlignmentPoints(relation);
  }

  private persistAlignmentPoints(relation: UmlRelation): void {
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
