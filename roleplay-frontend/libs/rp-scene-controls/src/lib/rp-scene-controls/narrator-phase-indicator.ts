import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import type { NarratorPhase } from './rp-scene-controls';

const PHASE_LABELS: Record<NarratorPhase, string> = {
  idle: 'Idle',
  exploring: 'Searching lore...',
  composing: 'Writing...',
  reviewing: 'Reviewing...',
  done: 'Done',
};

/**
 * Visual indicator for the narrator loop phase. This is RP-specific chrome:
 * rusty-view owns connection/stream status, while rusty-roleplay explains what
 * the narrator is doing inside the turn.
 */
@Component({
  selector: 'rp-narrator-phase-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="phase" [attr.data-phase]="phase()" aria-live="polite">
      <span class="dot" aria-hidden="true"></span>
      <span class="label">{{ label() }}</span>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .phase {
        display: inline-grid;
        grid-template-columns: 0.65rem minmax(0, auto);
        align-items: center;
        gap: 0.45rem;
        min-height: 1.5rem;
        color: var(--rv-color-text-secondary, #48515d);
        font-size: var(--rv-font-size-sm, 0.8125rem);
        transition:
          color 160ms ease,
          opacity 160ms ease;
      }

      .dot {
        width: 0.55rem;
        height: 0.55rem;
        border-radius: 999px;
        background: var(--rv-color-text-muted, #7a828d);
        transition:
          background 160ms ease,
          box-shadow 160ms ease,
          transform 160ms ease;
      }

      .label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .phase[data-phase='exploring'] {
        color: var(--rv-color-warning, #9a6700);
      }

      .phase[data-phase='exploring'] .dot {
        background: var(--rv-color-warning, #9a6700);
        box-shadow: 0 0 0 0.25rem
          color-mix(in srgb, currentColor 16%, transparent);
      }

      .phase[data-phase='composing'] {
        color: var(--rv-color-success, #1a7f37);
      }

      .phase[data-phase='composing'] .dot {
        background: var(--rv-color-success, #1a7f37);
        transform: scale(1.08);
      }

      .phase[data-phase='reviewing'] {
        color: var(--rv-color-accent, #1f6feb);
      }

      .phase[data-phase='reviewing'] .dot {
        background: var(--rv-color-accent, #1f6feb);
        box-shadow: 0 0 0 0.25rem
          color-mix(in srgb, currentColor 14%, transparent);
      }

      .phase[data-phase='done'] {
        opacity: 0.75;
      }
    `,
  ],
})
export class NarratorPhaseIndicatorComponent {
  readonly phase = input<NarratorPhase>('idle');

  protected readonly label = computed(() => PHASE_LABELS[this.phase()]);
}
