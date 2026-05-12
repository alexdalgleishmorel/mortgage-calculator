import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ScenarioMode } from '../models';

@Component({
  selector: 'app-scenario-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'scenario-toggle' },
  template: `
    <span class="scenario-thumb" style="width: calc(50% - 5px)" [style.transform]="thumbTransform()"></span>
    <button type="button" [class.active]="mode() === 'single'" (click)="modeChange.emit('single')">Single scenario</button>
    <button type="button" [class.active]="mode() === 'compare'" (click)="modeChange.emit('compare')">Compare A · B</button>
  `,
})
export class ScenarioToggleComponent {
  readonly mode = input.required<ScenarioMode>();
  readonly modeChange = output<ScenarioMode>();

  thumbTransform(): string {
    return `translateX(${this.mode() === 'compare' ? 100 : 0}%)`;
  }
}
