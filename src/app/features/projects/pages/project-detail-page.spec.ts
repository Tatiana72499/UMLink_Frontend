import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { DiagramApiService } from '../../diagram/data-access/diagram-api.service';
import { Diagram } from '../../diagram/models/diagram.model';
import { ProjectApiService } from '../data-access/project-api.service';
import { Project, ProjectMember } from '../models/project.model';
import { ProjectDetailPage } from './project-detail-page';
import { AuthSessionService } from '../../../core';

describe('ProjectDetailPage', () => {
  const project: Project = {
    id: 'project-1',
    name: 'Biblioteca',
    description: null,
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

  let projectResponse: Observable<Project>;
  let diagramsResponse: Observable<Diagram[]>;
  let createResponse: Observable<Diagram>;
  let updateProjectResponse: Observable<Project>;
  let deleteProjectResponse: Observable<void>;
  let updateDiagramResponse: Observable<Diagram>;
  let deleteDiagramResponse: Observable<void>;
  let importDiagramResponse: Observable<Diagram>;
  let membersResponse: Observable<ProjectMember[]>;
  let addMemberCalls: number;
  const projectApiStub: Pick<ProjectApiService, 'findById' | 'update' | 'delete' | 'findMembers' | 'addMember'> = {
    findById: () => projectResponse,
    update: () => updateProjectResponse,
    delete: () => deleteProjectResponse,
    findMembers: () => membersResponse,
    addMember: () => { addMemberCalls += 1; return of({ id: 'member-2', userId: 'user-2', name: 'Daniela', email: 'dani@umlink.dev', role: 'EDITOR' }); },
  };
  const diagramApiStub: Pick<DiagramApiService, 'findByProject' | 'create' | 'import' | 'update' | 'delete'> = {
    findByProject: () => diagramsResponse,
    create: () => createResponse,
    import: () => importDiagramResponse,
    update: () => updateDiagramResponse,
    delete: () => deleteDiagramResponse,
  };

  beforeEach(async () => {
    projectResponse = of(project);
    diagramsResponse = of([]);
    createResponse = of(diagram);
    updateProjectResponse = of({ ...project, name: 'Biblioteca actualizada', version: 1 });
    deleteProjectResponse = of(undefined);
    updateDiagramResponse = of({ ...diagram, name: 'Dominio actualizado', version: 1 });
    deleteDiagramResponse = of(undefined);
    importDiagramResponse = of({ ...diagram, id: 'diagram-imported', name: 'Importado' });
    addMemberCalls = 0;
    membersResponse = of([{ id: 'member-1', userId: 'user-1', name: 'Tatiana', email: 'tatiana@umlink.dev', role: 'OWNER' }]);
    await TestBed.configureTestingModule({
      imports: [ProjectDetailPage],
      providers: [
        provideRouter([]),
        { provide: ProjectApiService, useValue: projectApiStub },
        { provide: DiagramApiService, useValue: diagramApiStub },
        { provide: AuthSessionService, useValue: { user: () => ({ userId: 'user-1' }) } },
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

  it('actualiza visualmente el proyecto con la versión recibida', () => {
    const fixture = TestBed.createComponent(ProjectDetailPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.openEditProjectDialog();
    component.projectEditForm.setValue({ name: 'Biblioteca actualizada', description: '' });
    component.updateProject();

    expect(component.project()?.name).toBe('Biblioteca actualizada');
    expect(component.successMessage()).toContain('actualizado');
  });

  it('recarga el proyecto y avisa cuando un diagrama entra en conflicto de versión', () => {
    diagramsResponse = of([diagram]);
    updateDiagramResponse = throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'VERSION_CONFLICT' } }));
    const fixture = TestBed.createComponent(ProjectDetailPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.openEditDiagramDialog(diagram);
    component.diagramEditForm.setValue({ name: 'Otro nombre' });
    component.updateDiagram();

    expect(component.errorMessage()).toContain('cambió en otra sesión');
    expect(component.editingDiagram()).toBeNull();
  });

  it('elimina un diagrama tras confirmar la acción', () => {
    diagramsResponse = of([diagram]);
    const fixture = TestBed.createComponent(ProjectDetailPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.requestDiagramDeletion(diagram);
    component.deleteDiagram();

    expect(component.diagrams()).toEqual([]);
    expect(component.state()).toBe('empty');
  });

  it('impide invitar el correo de la propietaria', () => {
    const fixture = TestBed.createComponent(ProjectDetailPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.inviteForm.setValue({ email: 'tatiana@umlink.dev', role: 'EDITOR' });

    component.inviteMember();

    expect(component.inviteError()).toContain('propietaria');
    expect(addMemberCalls).toBe(0);
  });

  it('acepta PlantUML y agrega el diagrama importado al proyecto', () => {
    const fixture = TestBed.createComponent(ProjectDetailPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [new File(['@startuml\nclass Usuario\n@enduml'], 'modelo.puml')] });

    component.openImportDialog();
    component.selectImportFile({ target: input } as unknown as Event);
    component.importDiagram();

    expect(component.importFile()).toBeNull();
    expect(component.diagrams()[0].name).toBe('Importado');
    expect(component.successMessage()).toContain('importado');
  });
});
