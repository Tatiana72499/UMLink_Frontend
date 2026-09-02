import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { DiagramApiService } from '../data-access/diagram-api.service';
import { DiagramDetails, UmlClass } from '../models/diagram.model';
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
    version: 0,
    attributes: [],
  };

  let detailResponse: Observable<DiagramDetails>;
  let classResponse: Observable<UmlClass>;
  const diagramApiStub: Pick<DiagramApiService, 'findDetails' | 'createClass'> = {
    findDetails: () => detailResponse,
    createClass: () => classResponse,
  };

  beforeEach(async () => {
    detailResponse = of(details);
    classResponse = of(umlClass);
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

  it('crea una clase y la muestra en el lienzo', () => {
    const fixture = TestBed.createComponent(DiagramEditorPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.createForm.setValue({ name: umlClass.name });
    component.createClass();
    expect(component.state()).toBe('ready');
    expect(component.classes()).toEqual([umlClass]);
    expect(component.successMessage()).toContain(umlClass.name);
  });
});
