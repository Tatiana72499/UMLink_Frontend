import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-ui-dialog',
  template: `@if (open) {<div class="backdrop" (click)="closed.emit()"><section class="dialog" role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId" (click)="$event.stopPropagation()"><header><div><p>{{ eyebrow }}</p><h2 [id]="titleId">{{ title }}</h2></div><button type="button" aria-label="Cerrar" (click)="closed.emit()">×</button></header><ng-content /></section></div>}`,
  styleUrl: './ui-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiDialogComponent {
  @Input() open = false;
  @Input({ required: true }) title = '';
  @Input() eyebrow = '';
  @Input() titleId = 'dialog-title';
  @Output() readonly closed = new EventEmitter<void>();
}
