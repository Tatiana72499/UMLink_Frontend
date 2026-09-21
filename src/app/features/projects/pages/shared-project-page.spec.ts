import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AuthSessionService } from '../../../core';
import { DiagramApiService } from '../../diagram/data-access/diagram-api.service';
import { Diagram, DiagramDetails } from '../../diagram/models/diagram.model';
import { ProjectApiService } from '../data-access/project-api.service';
import { Project } from '../models/project.model';
import { SharedProjectPage } from './shared-project-page';

describe('SharedProjectPage', () => {
  const shareToken = '419a62e7-0f2c-44d8-98d1-c71f1e70197b';
  const project: Project = {
    id: 'project-1',
    name: 'Biblioteca',
    description: 'Modelo UML',
    ownerName: 'Tatiana',
    version: 0,
    createdAt: '2026-09-02T00:00:00Z',
  };
  const diagram: Diagram = {
    id: 'diagram-1',
    projectId: project.id,
    name: 'Dominio',
    version: 0,
    createdAt: '2026-09-02T00:00:00Z',
  };
  const details: DiagramDetails = {
    diagram,
    classes: [],
    relations: [],
    drawings: [],
  };

  let projectResponse: Observable<Project>;
  let diagramsResponse: Observable<Diagram[]>;
  let detailsResponse: Observable<DiagramDetails>;

  const projectApiStub: Pick<ProjectApiService, 'findSharedByToken'> = {
    findSharedByToken: () => projectResponse,
  };
  const diagramApiStub: Pick<DiagramApiService, 'findSharedByToken' | 'findSharedDetails'> = {
    findSharedByToken: () => diagramsResponse,
    findSharedDetails: () => detailsResponse,
  };

  beforeEach(async () => {
    projectResponse = of(project);
    diagramsResponse = of([diagram]);
    detailsResponse = of(details);

    await TestBed.configureTestingModule({
      imports: [SharedProjectPage],
      providers: [
        provideRouter([]),
        { provide: ProjectApiService, useValue: projectApiStub },
        { provide: DiagramApiService, useValue: diagramApiStub },
        { provide: AuthSessionService, useValue: { isAuthenticated: () => false } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ shareToken }) } },
        },
      ],
    }).compileComponents();
  });

  it('muestra el proyecto y su diagrama sin requerir una sesión', () => {
    const fixture = TestBed.createComponent(SharedProjectPage);
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('ready');
    expect(fixture.componentInstance.project()?.name).toBe('Biblioteca');
    expect(fixture.componentInstance.details()?.diagram.id).toBe(diagram.id);
  });

  it('muestra un error seguro si el enlace no puede abrirse', () => {
    projectResponse = throwError(() => new Error('No disponible'));
    const fixture = TestBed.createComponent(SharedProjectPage);
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('error');
    expect(fixture.componentInstance.errorMessage()).toContain('No pudimos abrir');
  });
});
