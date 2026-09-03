import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-empty-state',
  template: `<section class="empty-state"><span class="icon" aria-hidden="true">{{ icon }}</span><h2>{{ title }}</h2><p>{{ message }}</p><ng-content /></section>`,
  styleUrl: './ui-empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiEmptyStateComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) message = '';
  @Input() icon = '◇';
}
