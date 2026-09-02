import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DiagramApiService } from '../data-access/diagram-api.service';
import { Diagram, RelationType, UmlClass, UmlRelation } from '../models/diagram.model';

type EditorState = 'loading' | 'empty' | 'ready' | 'error' | 'selection';

@Component({
  selector: 'app-diagram-editor-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './diagram-editor-page.html',
  styleUrl: './diagram-editor-page.scss',
})
export class DiagramEditorPage {
  private readonly initialClassX = 100;
  private readonly initialClassY = 120;
  private readonly classHorizontalSpacing = 240;
  private readonly classVerticalSpacing = 190;
  private readonly classesPerRow = 3;
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
  readonly isRelationDialogOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly createForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });
  readonly attributeForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    dataType: ['', [Validators.required, Validators.maxLength(80)]],
    visibility: ['PRIVATE'],
  });
  readonly relationForm = this.formBuilder.nonNullable.group({
    sourceClassId: ['', Validators.required],
    targetClassId: ['', Validators.required],
    type: ['ASSOCIATION' as RelationType, Validators.required],
    sourceCardinality: ['1'],
    targetCardinality: ['1'],
  });
  private draggedClassId: string | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

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
    this.isCreateDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    this.isCreateDialogOpen.set(false);
    this.createForm.reset();
  }

  createClass(): void {
    if (!this.diagramId || this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const position = this.nextClassPosition();
    this.isSubmitting.set(true);
    this.diagramApi
      .createClass(this.diagramId, { name: this.createForm.controls.name.value, ...position })
      .subscribe({
        next: (umlClass) => {
          this.classes.update((classes) => [...classes, umlClass]);
          this.state.set('ready');
          this.successMessage.set(`La clase “${umlClass.name}” fue creada correctamente.`);
          this.isSubmitting.set(false);
          this.closeCreateDialog();
        },
        error: () => {
          this.errorMessage.set(
            'No pudimos crear la clase. Revisa el nombre e inténtalo nuevamente.',
          );
          this.isSubmitting.set(false);
        },
      });
  }

  selectClass(umlClass: UmlClass): void {
    this.selectedClassId.set(umlClass.id);
  }

  selectedClass(): UmlClass | null {
    const id = this.selectedClassId();
    return id ? this.classes().find((umlClass) => umlClass.id === id) ?? null : null;
  }

  addAttribute(): void {
    if (!this.selectedClass()) {
      this.errorMessage.set('Selecciona una clase antes de agregar un atributo.');
      return;
    }
    const selectedClass = this.selectedClass();
    if (!selectedClass || this.attributeForm.invalid) {
      this.attributeForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.diagramApi.createAttribute(selectedClass.id, this.attributeForm.getRawValue()).subscribe({
      next: (attribute) => {
        this.classes.update((classes) => classes.map((umlClass) =>
          umlClass.id === selectedClass.id
            ? { ...umlClass, attributes: [...umlClass.attributes, attribute] }
            : umlClass,
        ));
        this.successMessage.set(`El atributo “${attribute.name}” fue agregado.`);
        this.isSubmitting.set(false);
        this.attributeForm.reset({ name: '', dataType: '', visibility: 'PRIVATE' });
      },
      error: () => {
        this.errorMessage.set('No pudimos agregar el atributo. Revisa los datos e inténtalo nuevamente.');
        this.isSubmitting.set(false);
      },
    });
  }

  startDrag(event: PointerEvent, umlClass: UmlClass, canvas: HTMLElement): void {
    const bounds = canvas.getBoundingClientRect();
    this.selectClass(umlClass);
    this.draggedClassId = umlClass.id;
    this.dragOffsetX = event.clientX - bounds.left - umlClass.positionX;
    this.dragOffsetY = event.clientY - bounds.top - umlClass.positionY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  dragClass(event: PointerEvent, canvas: HTMLElement): void {
    if (!this.draggedClassId) {
      return;
    }
    const bounds = canvas.getBoundingClientRect();
    const positionX = Math.max(0, event.clientX - bounds.left - this.dragOffsetX);
    const positionY = Math.max(0, event.clientY - bounds.top - this.dragOffsetY);
    this.classes.update((classes) => classes.map((umlClass) =>
      umlClass.id === this.draggedClassId ? { ...umlClass, positionX, positionY } : umlClass,
    ));
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
    }).subscribe({
      next: (updatedClass) => this.classes.update((classes) => classes.map((umlClass) =>
        umlClass.id === updatedClass.id ? updatedClass : umlClass,
      )),
      error: () => this.errorMessage.set('No pudimos guardar la nueva posición de la clase.'),
    });
  }

  relationGeometry(relation: UmlRelation): { x1: number; y1: number; x2: number; y2: number } | null {
    const source = this.classes().find((umlClass) => umlClass.id === relation.sourceClassId);
    const target = this.classes().find((umlClass) => umlClass.id === relation.targetClassId);
    if (!source || !target) {
      return null;
    }
    return { x1: source.positionX + 100, y1: source.positionY + 35, x2: target.positionX + 100, y2: target.positionY + 35 };
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

  openRelationDialog(): void {
    if (this.classes().length < 2) {
      this.errorMessage.set('Crea al menos dos clases antes de establecer una relación.');
      return;
    }
    const first = this.classes()[0].id;
    const second = this.classes()[1].id;
    this.relationForm.reset({ sourceClassId: first, targetClassId: second, type: 'ASSOCIATION', sourceCardinality: '1', targetCardinality: '1' });
    this.isRelationDialogOpen.set(true);
  }

  closeRelationDialog(): void {
    this.isRelationDialogOpen.set(false);
  }

  relationUsesCardinality(): boolean {
    const type = this.relationForm.controls.type.value;
    return type === 'ASSOCIATION' || type === 'AGGREGATION' || type === 'COMPOSITION';
  }

  createRelation(): void {
    if (!this.diagramId || this.relationForm.invalid) {
      this.relationForm.markAllAsTouched();
      return;
    }
    const request = this.relationForm.getRawValue();
    if (request.sourceClassId === request.targetClassId) {
      this.errorMessage.set('Selecciona dos clases diferentes para crear la relación.');
      return;
    }
    this.isSubmitting.set(true);
    this.diagramApi.createRelation(this.diagramId, {
      ...request,
      sourceCardinality: this.relationUsesCardinality() ? request.sourceCardinality : null,
      targetCardinality: this.relationUsesCardinality() ? request.targetCardinality : null,
    }).subscribe({
      next: (relation) => {
        this.relations.update((relations) => [...relations, relation]);
        this.successMessage.set(`${this.relationLabel(relation.type)} creada correctamente.`);
        this.isSubmitting.set(false);
        this.closeRelationDialog();
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

  private nextClassPosition(): { positionX: number; positionY: number } {
    const index = this.classes().length;
    return {
      positionX: this.initialClassX + (index % this.classesPerRow) * this.classHorizontalSpacing,
      positionY:
        this.initialClassY + Math.floor(index / this.classesPerRow) * this.classVerticalSpacing,
    };
  }
}
