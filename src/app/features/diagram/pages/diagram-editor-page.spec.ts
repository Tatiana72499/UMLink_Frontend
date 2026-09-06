import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { DiagramApiService } from '../data-access/diagram-api.service';
import { DiagramActivity, DiagramDetails, UmlAttribute, UmlClass, UmlOperation, UmlRelation } from '../models/diagram.model';
import { ProjectApiService } from '../../projects/data-access/project-api.service';
import { AuthSessionService } from '../../../core';
import { DiagramEditorPage } from './diagram-editor-page';

describe('DiagramEditorPage', () => {
  const diagramId = 'diagram-1';
  const details: DiagramDetails = {
    diagram: {
      id: diagramId,
      projectId: 'project-1',
      name: 'Dominio',
      version: 0,
      createdAt: '2026-09-02T00:00:00Z',
    },
    classes: [],
    relations: [],
    drawings: [],
  };
  const umlClass: UmlClass = {
    id: 'class-1',
    diagramId,
    name: 'Usuario',
    positionX: 100,
    positionY: 120,
    fillColor: '#EAF3FF',
    version: 0,
    attributes: [],
    operations: [],
  };
  const umlAttribute: UmlAttribute = {
    id: 'attribute-1',
    umlClassId: umlClass.id,
    name: 'email',
    dataType: 'String',
    visibility: 'PRIVATE',
  };
  const umlRelation: UmlRelation = {
    id: 'relation-1',
    diagramId,
    sourceClassId: umlClass.id,
    targetClassId: 'class-2',
    type: 'ASSOCIATION',
    label: 'posee',
    sourceCardinality: '1..1',
    targetCardinality: '1..*',
  };
  const umlOperation: UmlOperation = {
    id: 'operation-1',
    umlClassId: umlClass.id,
    name: 'registrar',
    visibility: 'PUBLIC',
    returnType: 'void',
    parameters: [{ id: 'parameter-1', name: 'correo', dataType: 'String', parameterOrder: 0 }],
  };

  let detailResponse: Observable<DiagramDetails>;
  let classResponse: Observable<UmlClass>;
  let attributeResponse: Observable<UmlAttribute>;
  let relationResponse: Observable<UmlRelation>;
  let operationResponse: Observable<UmlOperation>;
  let activityResponse: Observable<DiagramActivity[]>;
  let voidResponse: Observable<void>;
  let diagramResponse: Observable<DiagramDetails['diagram']>;
  let exportResponse: Observable<Blob>;
  const projectApiStub: Pick<ProjectApiService, 'findMembers'> = {
    findMembers: () => of([{ id: 'member-1', userId: 'user-1', name: 'Tatiana', email: 'tatiana@umlink.dev', role: 'OWNER' }]),
  };
  const diagramApiStub: Pick<DiagramApiService, 'clearDrawings' | 'createAttribute' | 'createClass' | 'createDrawing' | 'createOperation' | 'delete' | 'deleteAttribute' | 'deleteClass' | 'deleteDrawing' | 'deleteOperation' | 'deleteRelation' | 'export' | 'findActivity' | 'findDetails' | 'import' | 'update' | 'updateAttribute' | 'updateClass' | 'updateOperation' | 'updateRelation' | 'updateRelationCardinality'> = {
    findDetails: () => detailResponse,
    findActivity: () => activityResponse,
    export: () => exportResponse,
    import: () => diagramResponse,
    update: () => diagramResponse,
    delete: () => voidResponse,
    createClass: () => classResponse,
    createAttribute: () => attributeResponse,
    updateClass: () => classResponse,
    updateAttribute: () => attributeResponse,
    createOperation: () => operationResponse,
    updateOperation: () => operationResponse,
    updateRelationCardinality: () => relationResponse,
    updateRelation: () => relationResponse,
    deleteClass: () => voidResponse,
    deleteAttribute: () => voidResponse,
    deleteOperation: () => voidResponse,
    deleteRelation: () => voidResponse,
    createDrawing: () => of({ id: 'drawing-1', svgPath: 'M 1 1 L 2 2' }),
    deleteDrawing: () => voidResponse,
    clearDrawings: () => voidResponse,
  };

  beforeEach(async () => {
    detailResponse = of(details);
    classResponse = of(umlClass);
    attributeResponse = of(umlAttribute);
    relationResponse = of({ ...umlRelation, sourceCardinality: '0..1', targetCardinality: '1..*' });
    operationResponse = of(umlOperation);
    activityResponse = of([]);
    voidResponse = of(undefined);
    diagramResponse = of({ ...details.diagram, name: 'Dominio actualizado', version: 1 });
    exportResponse = of(new Blob(['<umlinkUml />'], { type: 'application/xml' }));
    await TestBed.configureTestingModule({
      imports: [DiagramEditorPage],
      providers: [
        provideRouter([]),
        { provide: DiagramApiService, useValue: diagramApiStub },
        { provide: ProjectApiService, useValue: projectApiStub },
        { provide: AuthSessionService, useValue: { token: () => 'test-token', user: () => ({ userId: 'user-1' }) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ diagramId }) } },
        },
      ],
    }).compileComponents();
  });

  it('muestra lienzo vacío cuando el diagrama no tiene clases', () => {
    const fixture = TestBed.createComponent(DiagramEditorPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('empty');
  });

  it('permite plegar y restaurar el resumen desde el control del lienzo', () => {
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.toggleSummary();
    expect(component.isSummaryVisible()).toBe(false);

    component.toggleSummary();
    expect(component.isSummaryVisible()).toBe(true);
  });

  it('guarda un trazo cuando se termina de dibujar', () => {
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const canvas = document.createElement('section');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 600));

    component.toggleDrawingMode();
    component.onCanvasPointerDown({ clientX: 10, clientY: 20 } as PointerEvent, canvas);
    component.onCanvasPointerMove({ clientX: 30, clientY: 40 } as PointerEvent, canvas);
    component.onCanvasPointerUp();

    expect(component.freehandPaths()).toEqual([{ id: 'drawing-1', svgPath: 'M 1 1 L 2 2' }]);
  });

  it('muestra error cuando no puede cargar el detalle', () => {
    detailResponse = throwError(() => new Error('No disponible'));
    const fixture = TestBed.createComponent(DiagramEditorPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('error');
  });

  it('prepara una clase y la coloca donde la persona hace clic', () => {
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.createForm.setValue({ name: umlClass.name });
    component.prepareClassPlacement();
    expect(component.editorMode()).toBe('place-class');
    component.onCanvasPointerDown({ clientX: 100, clientY: 120 } as PointerEvent, document.createElement('section'));
    expect(component.state()).toBe('ready');
    expect(component.classes()).toEqual([umlClass]);
    expect(component.successMessage()).toContain(umlClass.name);
  });

  it('agrega un atributo desde una declaración UML en línea', () => {
    detailResponse = of({ ...details, classes: [umlClass] });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.openAttributeEditor(umlClass);
    component.attributeLineForm.setValue({ name: 'email', dataType: 'STRING', visibility: 'PRIVATE' });
    component.addAttribute();
    expect(component.classes()[0].attributes).toEqual([umlAttribute]);
    expect(component.successMessage()).toContain(umlAttribute.name);
  });

  it('agrega una operación UML con retorno y parámetros tipados', () => {
    detailResponse = of({ ...details, classes: [umlClass] });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.openOperationEditor(umlClass);
    component.operationForm.setValue({ name: 'registrar', visibility: 'PUBLIC', returnType: 'VOID' });
    component.addOperationParameter();
    component.operationParameters.at(0).setValue({ name: 'correo', dataType: 'STRING' });
    component.saveOperation();

    expect(component.classes()[0].operations).toEqual([umlOperation]);
    expect(component.successMessage()).toContain('operación');
  });

  it('activa la relación para conectar clases mediante arrastre', () => {
    detailResponse = of({ ...details, classes: [umlClass, { ...umlClass, id: 'class-2', name: 'Proyecto' }] });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.activateRelationTool('ASSOCIATION');
    expect(component.editorMode()).toBe('create-relation');
    expect(component.successMessage()).toContain('Arrastra');
  });

  it('prepara la herramienta de clase intermedia antes de arrastrar la asociación', () => {
    detailResponse = of({ ...details, classes: [umlClass, { ...umlClass, id: 'class-2', name: 'Proyecto' }] });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.openAssociationClassDialog();
    component.associationClassForm.setValue({ name: 'Inscripción' });
    component.prepareAssociationClassRelation();

    expect(component.editorMode()).toBe('create-relation');
    expect(component.isCreatingAssociationClass()).toBe(true);
    expect(component.pendingAssociationClassName()).toBe('Inscripción');
  });

  it('prepara una relación seleccionada para editar cardinalidades con opciones cerradas', () => {
    detailResponse = of({ ...details, classes: [umlClass], relations: [umlRelation] });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.selectRelation(umlRelation);
    expect(component.relationEditForm.controls.sourceCardinality.value).toBe('1..1');
    expect(component.relationEditForm.controls.targetCardinality.value).toBe('1..*');
  });

  it('representa una relación recursiva como un lazo visible', () => {
    const recursiveRelation = { ...umlRelation, targetClassId: umlClass.id };
    detailResponse = of({ ...details, classes: [umlClass], relations: [recursiveRelation] });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const geometry = component.relationGeometry(recursiveRelation);

    expect(geometry?.points.trim().split(' ').length).toBe(4);
    expect(geometry?.x1).toBe(umlClass.positionX + 200);
  });

  it('carga el historial confirmado del diagrama', () => {
    activityResponse = of([{
      id: 'activity-1', actorId: 'user-2', actorName: 'María', action: 'creó una relación', createdAt: '2026-09-04T18:00:00Z',
    }]);
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.openActivityHistory();

    expect(component.activityHistory()).toHaveLength(1);
    expect(component.activityHistoryState()).toBe('ready');
  });

  it('abre el selector de formatos para descargar desde el backend', () => {
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.openExportDialog();

    expect(component.isExportDialogOpen()).toBe(true);
  });

  it('actualiza una clase seleccionada', () => {
    detailResponse = of({ ...details, classes: [umlClass] });
    classResponse = of({ ...umlClass, name: 'Cuenta' });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.selectClass(umlClass);
    component.classEditForm.setValue({ name: 'Cuenta' });
    component.saveClass();
    expect(component.classes()[0].name).toBe('Cuenta');
  });

  it('muestra de inmediato el color elegido aunque el servidor responda sin ese campo', () => {
    detailResponse = of({ ...details, classes: [umlClass] });
    classResponse = of({ ...umlClass, fillColor: null });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.selectClass(umlClass);
    component.applyClassColor('#E7F7ED');
    expect(component.classes()[0].fillColor).toBe('#E7F7ED');
  });

  it('no añade una flecha a una asociación UML', () => {
    const fixture = TestBed.createComponent(DiagramEditorPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.relationMarkerEnd('ASSOCIATION')).toBeNull();
  });

  it('mantiene visualmente una palabra de enlace enviada al servidor', () => {
    detailResponse = of({ ...details, classes: [umlClass], relations: [umlRelation] });
    relationResponse = of({ ...umlRelation, label: null });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.openRelationLabelEditor(umlRelation);
    component.relationLabelForm.setValue({ label: 'administra' });
    component.saveRelationLabel(umlRelation);
    expect(component.relations()[0].label).toBe('administra');
  });

  it('abre la palabra de enlace con doble clic en el centro del conector', () => {
    detailResponse = of({ ...details, classes: [umlClass], relations: [umlRelation] });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.openRelationLabelEditor(umlRelation);

    expect(component.editingRelationLabelId()).toBe(umlRelation.id);
  });

  it('identifica la clase intermedia asignada a una asociación', () => {
    const associationClass = { ...umlClass, id: 'class-3', name: 'Matrícula' };
    detailResponse = of({
      ...details,
      classes: [umlClass, associationClass],
      relations: [{ ...umlRelation, associationClassId: associationClass.id }],
    });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.associationClass(component.relations()[0])).toEqual(associationClass);
  });

  it('usa un punto manual sin forzar un trazado en forma de L', () => {
    const target = { ...umlClass, id: 'class-2', name: 'Proyecto', positionX: 500, positionY: 300 };
    const relation = { ...umlRelation, bendX: 260, bendY: 260 };
    detailResponse = of({ ...details, classes: [umlClass, target], relations: [relation] });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const geometry = component.relationGeometry(relation);

    expect(geometry?.points.trim().split(' ').length).toBe(3);
    expect(geometry?.points).toContain('260,260');
  });

  it('incluye varios puntos de alineación en el conector', () => {
    const target = { ...umlClass, id: 'class-2', name: 'Proyecto', positionX: 500, positionY: 300 };
    const relation = { ...umlRelation, alignmentPoints: [{ x: 220, y: 180 }, { x: 340, y: 270 }] };
    detailResponse = of({ ...details, classes: [umlClass, target], relations: [relation] });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const geometry = component.relationGeometry(relation);

    expect(geometry?.alignmentPoints).toEqual(relation.alignmentPoints);
    expect(geometry?.points.trim().split(' ').length).toBe(4);
  });

  it('elimina un atributo tras confirmar la acción', () => {
    detailResponse = of({ ...details, classes: [{ ...umlClass, attributes: [umlAttribute] }] });
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.requestDelete({ kind: 'attribute', id: umlAttribute.id, label: 'El atributo' });
    component.confirmDelete();
    expect(component.classes()[0].attributes).toEqual([]);
  });

  it('actualiza el nombre del diagrama desde el editor', () => {
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.openEditDiagramDialog();
    component.diagramEditForm.setValue({ name: 'Dominio actualizado' });
    component.updateDiagram();

    expect(component.diagram()?.name).toBe('Dominio actualizado');
    expect(component.successMessage()).toContain('actualizado');
  });

  it('recarga el diagrama y muestra un aviso seguro ante un conflicto de versión', () => {
    diagramResponse = throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'VERSION_CONFLICT' } }));
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.openEditDiagramDialog();
    component.diagramEditForm.setValue({ name: 'Cambio concurrente' });
    component.updateDiagram();

    expect(component.errorMessage()).toContain('cambió en otra sesión');
  });

  it('recarga el diagrama y muestra actividad contextual cuando recibe un cambio remoto', () => {
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.handleCollaborationEvent({
      diagramId,
      type: 'DIAGRAM_CHANGED',
      payload: 'creó una clase',
      actor: { userId: 'other-user', name: 'María' },
    });

    expect(component.collaborationActivity()[0]).toMatchObject({ name: 'María', action: 'creó una clase' });
  });

  it('muestra el trazo remoto antes de que la otra persona lo guarde', () => {
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.handleCollaborationEvent({
      diagramId,
      type: 'DRAWING_PREVIEW',
      payload: { svgPath: 'M 10 10 L 30 30' },
      actor: { userId: 'other-user', name: 'María' },
    });

    expect(component.remoteDrawingPreviews()).toEqual([
      { userId: 'other-user', name: 'María', svgPath: 'M 10 10 L 30 30' },
    ]);
  });

  it('resalta una clase mientras otra persona la arrastra', () => {
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.handleCollaborationEvent({
      diagramId,
      type: 'ELEMENT_INTERACTION',
      payload: { elementId: umlClass.id, elementType: 'CLASS', state: 'DRAGGING' },
      actor: { userId: 'other-user', name: 'María' },
    });

    expect(component.isClassInteractedRemotely(umlClass.id)).toBe(true);
  });
});
