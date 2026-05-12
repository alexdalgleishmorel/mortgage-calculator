import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type Theme = 'dark' | 'light';

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="theme-toggle" [attr.aria-label]="ariaLabel()" [title]="ariaLabel()" (click)="toggle.emit()">
      @if (theme() === 'dark') {
        <!-- sun: switch to Dawn -->
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.7" />
          <g stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
            <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.2 5.2l1.85 1.85M16.95 16.95l1.85 1.85M18.8 5.2l-1.85 1.85M7.05 16.95L5.2 18.8" />
          </g>
        </svg>
      } @else {
        <!-- moon: switch to Dusk -->
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a7 7 0 0 0 10.7 10.7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
        </svg>
      }
    </button>
  `,
})
export class ThemeToggleComponent {
  readonly theme = input.required<Theme>();
  readonly toggle = output<void>();

  readonly ariaLabel = computed(() =>
    this.theme() === 'dark' ? 'Switch to Dawn (light theme)' : 'Switch to Dusk (dark theme)');
}
