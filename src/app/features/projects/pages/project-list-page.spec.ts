import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { ProjectApiService } from '../data-access/project-api.service';
import { Project } from '../models/project.model';
import { ProjectListPage } from './project-list-page';

describe('ProjectListPage', () => {
  const project: Project = {
    id: '5c01fc9a-cd07-4e3f-8ef6-9d06c0be712b',
    name: 'Biblioteca',
    description: 'Modelo de biblioteca',
    ownerName: 'Tatiana',
    version: 0,
    createdAt: '2026-09-01T00:00:00Z',
  };

  let findAllResponse: Observable<Project[]>;
  let createResponse: Observable<Project>;
  const apiStub: Pick<ProjectApiService, 'findAll' | 'create'> = {
    findAll: () => findAllResponse,
    create: () => createResponse,
  };

  beforeEach(async () => {
    findAllResponse = of([]);
    createResponse = of(project);
    await TestBed.configureTestingModule({
      imports: [ProjectListPage],
      providers: [provideRouter([]), { provide: ProjectApiService, useValue: apiStub }],
    }).compileComponents();
  });

  it('muestra carga mientras la lista de proyectos responde', () => {
    findAllResponse = NEVER;
    const fixture = TestBed.createComponent(ProjectListPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('loading');
  });

  it('muestra estado vacío cuando no existen proyectos', () => {
    const fixture = TestBed.createComponent(ProjectListPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('empty');
  });

  it('muestra error cuando no puede cargar los proyectos', () => {
    findAllResponse = throwError(() => new Error('Backend no disponible'));
    const fixture = TestBed.createComponent(ProjectListPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('error');
    expect(fixture.componentInstance.errorMessage()).toContain('Ocurrió un problema al cargar');
  });

  it('agrega el proyecto creado y muestra éxito', () => {
    const fixture = TestBed.createComponent(ProjectListPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.createForm.setValue({
      name: project.name,
      description: project.description ?? '',
    });
    component.createProject();
    expect(component.state()).toBe('ready');
    expect(component.projects()).toEqual([project]);
    expect(component.successMessage()).toContain(project.name);
  });
});
