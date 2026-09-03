import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { DiagramApiService } from '../data-access/diagram-api.service';
import { DiagramDetails, UmlAttribute, UmlClass, UmlRelation } from '../models/diagram.model';
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

  let detailResponse: Observable<DiagramDetails>;
  let classResponse: Observable<UmlClass>;
  let attributeResponse: Observable<UmlAttribute>;
  let relationResponse: Observable<UmlRelation>;
  let voidResponse: Observable<void>;
  const diagramApiStub: Pick<DiagramApiService, 'createAttribute' | 'createClass' | 'deleteAttribute' | 'deleteClass' | 'deleteRelation' | 'findDetails' | 'updateAttribute' | 'updateClass' | 'updateRelation' | 'updateRelationCardinality'> = {
    findDetails: () => detailResponse,
    createClass: () => classResponse,
    createAttribute: () => attributeResponse,
    updateClass: () => classResponse,
    updateAttribute: () => attributeResponse,
    updateRelationCardinality: () => relationResponse,
    updateRelation: () => relationResponse,
    deleteClass: () => voidResponse,
    deleteAttribute: () => voidResponse,
    deleteRelation: () => voidResponse,
  };

  beforeEach(async () => {
    detailResponse = of(details);
    classResponse = of(umlClass);
    attributeResponse = of(umlAttribute);
    relationResponse = of({ ...umlRelation, sourceCardinality: '0..1', targetCardinality: '1..*' });
    voidResponse = of(undefined);
    await TestBed.configureTestingModule({
      imports: [DiagramEditorPage],
      providers: [
        provideRouter([]),
        { provide: DiagramApiService, useValue: diagramApiStub },
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
});
