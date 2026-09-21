import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthSessionService } from '../../../core';
import { DiagramApiService } from '../../diagram/data-access/diagram-api.service';
import {
  Diagram,
  DiagramDetails,
  RelationType,
  UmlAttribute,
  UmlOperation,
  UmlRelation,
} from '../../diagram/models/diagram.model';
import { ProjectApiService } from '../data-access/project-api.service';
import { Project } from '../models/project.model';

type SharedProjectState = 'loading' | 'empty' | 'ready' | 'error';

@Component({
  selector: 'app-shared-project-page',
  imports: [RouterLink],
  templateUrl: './shared-project-page.html',
  styleUrl: './shared-project-page.scss',
})
export class SharedProjectPage {
  private readonly route = inject(ActivatedRoute);
  private readonly projectApi = inject(ProjectApiService);
  private readonly diagramApi = inject(DiagramApiService);
  private readonly shareToken = this.route.snapshot.paramMap.get('shareToken');

  readonly isAuthenticated = inject(AuthSessionService).isAuthenticated;
  readonly state = signal<SharedProjectState>('loading');
  readonly project = signal<Project | null>(null);
  readonly diagrams = signal<Diagram[]>([]);
  readonly selectedDiagram = signal<Diagram | null>(null);
  readonly details = signal<DiagramDetails | null>(null);
  readonly isDiagramLoading = signal(false);
  readonly errorMessage = signal('');
  private requestedDiagramId: string | null = null;

  constructor() {
    this.load();
  }

  load(): void {
    if (!this.shareToken) {
      this.errorMessage.set('El enlace compartido no es válido.');
      this.state.set('error');
      return;
    }

    this.state.set('loading');
    this.errorMessage.set('');
    forkJoin({
      project: this.projectApi.findSharedByToken(this.shareToken),
      diagrams: this.diagramApi.findSharedByToken(this.shareToken),
    }).subscribe({
      next: ({ project, diagrams }) => {
        this.project.set(project);
        this.diagrams.set(diagrams);
        if (diagrams.length === 0) {
          this.state.set('empty');
          return;
        }

        this.state.set('ready');
        this.selectDiagram(diagrams[0]);
      },
      error: () => {
        this.errorMessage.set(
          'No pudimos abrir este enlace. Puede ser incorrecto o ya no estar disponible.',
        );
        this.state.set('error');
      },
    });
  }

  selectDiagram(diagram: Diagram): void {
    if (!this.shareToken) {
      return;
    }

    this.selectedDiagram.set(diagram);
    this.details.set(null);
    this.isDiagramLoading.set(true);
    this.requestedDiagramId = diagram.id;

    this.diagramApi.findSharedDetails(this.shareToken, diagram.id).subscribe({
      next: (details) => {
        if (this.requestedDiagramId !== details.diagram.id) {
          return;
        }
        this.details.set(details);
        this.isDiagramLoading.set(false);
      },
      error: () => {
        if (this.requestedDiagramId !== diagram.id) {
          return;
        }
        this.errorMessage.set('No pudimos cargar el diagrama seleccionado.');
        this.isDiagramLoading.set(false);
      },
    });
  }

  protectedProjectUrl(): string {
    return this.project() ? `/projects/${this.project()!.id}` : '/projects';
  }

  relationText(relation: UmlRelation): string {
    const classes = this.details()?.classes ?? [];
    const source =
      classes.find((item) => item.id === relation.sourceClassId)?.name ?? 'Clase no disponible';
    const target =
      classes.find((item) => item.id === relation.targetClassId)?.name ?? 'Clase no disponible';
    const cardinalities =
      relation.sourceCardinality && relation.targetCardinality
        ? ` (${relation.sourceCardinality} — ${relation.targetCardinality})`
        : '';
    const label = relation.label ? ` · ${relation.label}` : '';
    return `${source} — ${this.relationTypeLabel(relation.type)} — ${target}${cardinalities}${label}`;
  }

  formatAttribute(attribute: UmlAttribute): string {
    const primaryKey = attribute.primaryKey ? 'PK · ' : '';
    return `${this.visibilitySymbol(attribute.visibility)} ${primaryKey}${attribute.name}: ${this.prettyType(attribute.dataType)}`;
  }

  formatOperation(operation: UmlOperation): string {
    const parameters = operation.parameters
      .map((parameter) => `${parameter.name}: ${this.prettyType(parameter.dataType)}`)
      .join(', ');
    return `${this.visibilitySymbol(operation.visibility)} ${operation.name}(${parameters}): ${this.prettyType(operation.returnType)}`;
  }

  private relationTypeLabel(type: RelationType): string {
    const labels: Record<RelationType, string> = {
      ASSOCIATION: 'Asociación',
      AGGREGATION: 'Agregación',
      COMPOSITION: 'Composición',
      GENERALIZATION: 'Herencia',
      REALIZATION: 'Realización',
      DEPENDENCY: 'Dependencia',
    };
    return labels[type];
  }

  private visibilitySymbol(visibility: string): string {
    return visibility === 'PRIVATE' ? '−' : visibility === 'PROTECTED' ? '#' : '+';
  }

  private prettyType(type: string): string {
    return type
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }
}
