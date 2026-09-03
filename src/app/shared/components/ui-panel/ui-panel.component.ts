import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-panel',
  template: `<section class="ui-panel" [class.danger]="variant === 'danger'"><ng-content /></section>`,
  styleUrl: './ui-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiPanelComponent {
  @Input() variant: 'default' | 'danger' = 'default';
}
