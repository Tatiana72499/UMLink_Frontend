import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

type ButtonVariant = 'primary' | 'secondary';

@Component({
  selector: 'app-ui-button',
  template: `<button [class]="'ui-button ' + variant" [disabled]="disabled" [type]="type" (click)="pressed.emit()"><ng-content /></button>`,
  styleUrl: './ui-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() type: 'button' | 'submit' = 'button';
  @Input() disabled = false;
  @Output() readonly pressed = new EventEmitter<void>();
}
