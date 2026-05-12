import { ChangeDetectionStrategy, Component, OnInit, computed, input, signal } from '@angular/core';

@Component({
  selector: 'app-collapsible-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'section glass',
    '[class.open]': 'open()',
    '[class.collapsed]': '!open()',
  },
  template: `
    <div
      class="section-head"
      role="button"
      tabindex="0"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
      (keydown.enter)="onKey($event)"
      (keydown.space)="onKey($event)"
    >
      <div class="section-head-text">
        <h2 class="section-title">
          @if (accent()) {
            <span class="section-accent" [style.background]="accent()" [style.boxShadow]="accentGlow()"></span>
          }
          {{ title() }}
        </h2>
        @if (subtitle()) {<p class="section-sub">{{ subtitle() }}</p>}
      </div>
      <div class="section-head-right" (click)="$event.stopPropagation()">
        <ng-content select="[section-header-extra]" />
        <span class="section-chevron" [class.open]="open()" aria-hidden="true" (click)="toggle()">⌃</span>
      </div>
    </div>
    <div class="section-body" [style.display]="open() ? 'block' : 'none'">
      <ng-content />
    </div>
  `,
})
export class CollapsibleSectionComponent implements OnInit {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly accent = input<string | null>(null);
  readonly defaultOpen = input(true);

  readonly open = signal(true);
  readonly accentGlow = computed(() => `0 0 16px ${this.accent()}`);

  ngOnInit(): void {
    this.open.set(this.defaultOpen());
  }

  toggle(): void {
    this.open.update(o => !o);
  }

  onKey(e: Event): void {
    e.preventDefault();
    this.toggle();
  }
}
