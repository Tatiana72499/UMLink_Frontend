import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { DiagramApiService } from '../../diagram/data-access/diagram-api.service';
import { Diagram } from '../../diagram/models/diagram.model';
import { ProjectApiService } from '../data-access/project-api.service';
import { Project } from '../models/project.model';
import { ProjectDetailPage } from './project-detail-page';

describe('ProjectDetailPage', () => {
  const project: Project = {
    id: 'project-1',
    name: 'Biblioteca',
    description: null,
    ownerName: 'Tatiana',
    createdAt: '2026-09-02T00:00:00Z',
  };
  const diagram: Diagram = {
    id: 'diagram-1',
    projectId: project.id,
    name: 'Dominio',
    version: 0,
    createdAt: '2026-09-02T00:00:00Z',
  };

  let projectResponse: Observable<Project>;
  let diagramsResponse: Observable<Diagram[]>;
  let createResponse: Observable<Diagram>;
  const projectApiStub: Pick<ProjectApiService, 'findById'> = { findById: () => projectResponse };
  const diagramApiStub: Pick<DiagramApiService, 'findByProject' | 'create'> = {
    findByProject: () => diagramsResponse,
    create: () => createResponse,
  };

  beforeEach(async () => {
    projectResponse = of(project);
    diagramsResponse = of([]);
    createResponse = of(diagram);
    await TestBed.configureTestingModule({
      imports: [ProjectDetailPage],
      providers: [
        provideRouter([]),
        { provide: ProjectApiService, useValue: projectApiStub },
        { provide: DiagramApiService, useValue: diagramApiStub },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ projectId: project.id }) } },
        },
      ],
    }).compileComponents();
  });

  it('muestra estado vacío cuando el proyecto no tiene diagramas', () => {
    const fixture = TestBed.createComponent(ProjectDetailPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('empty');
  });

  it('muestra error cuando no puede cargar el proyecto', () => {
    projectResponse = throwError(() => new Error('No disponible'));
    const fixture = TestBed.createComponent(ProjectDetailPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('error');
  });

  it('muestra los diagramas existentes del proyecto', () => {
    diagramsResponse = of([diagram]);
    const fixture = TestBed.createComponent(ProjectDetailPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('ready');
    expect(fixture.componentInstance.diagrams()).toEqual([diagram]);
  });

  it('agrega el diagrama creado y muestra éxito', () => {
    const fixture = TestBed.createComponent(ProjectDetailPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.createForm.setValue({ name: diagram.name });
    component.createDiagram();
    expect(component.state()).toBe('ready');
    expect(component.diagrams()).toEqual([diagram]);
    expect(component.successMessage()).toContain(diagram.name);
  });
});
