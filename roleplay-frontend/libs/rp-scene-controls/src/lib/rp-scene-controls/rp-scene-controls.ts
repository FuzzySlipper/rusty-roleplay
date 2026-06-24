import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/**
 * Narrator agent loop phase. The narrator explores lore, then composes the
 * reply (docs/02-narrator-agent-and-loop.md). Surfaced as an indicator so the
 * player can see why a turn is taking time.
 */
export type NarratorPhase = 'idle' | 'exploring' | 'composing';

/** Scene mood presets that bias the narrator's tonal register. */
export type SceneMood = 'neutral' | 'tense' | 'tender' | 'ominous' | 'playful';

const MOODS: readonly SceneMood[] = [
  'neutral',
  'tense',
  'tender',
  'ominous',
  'playful',
];

/**
 * Scene controls: a narrator-phase indicator and a mood selector. Presentational
 * — phase and mood come in via inputs; mood changes are emitted.
 */
@Component({
  selector: 'rp-scene-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rp-scene-controls">
      <h3>Scene</h3>
      <p class="phase" [attr.data-phase]="phase()">
        <span class="dot"></span>
        {{ phaseLabel() }}
      </p>
      <label>
        Mood
        <select [value]="mood()" (change)="onMood($event)">
          @for (option of moods; track option) {
            <option [value]="option">{{ option }}</option>
          }
        </select>
      </label>
    </section>
  `,
  styles: [
    `
      .phase {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        text-transform: capitalize;
      }
      .dot {
        width: 0.6rem;
        height: 0.6rem;
        border-radius: 50%;
        background: #888;
      }
      .phase[data-phase='exploring'] .dot {
        background: #d8a200;
      }
      .phase[data-phase='composing'] .dot {
        background: #2a8f3c;
      }
    `,
  ],
})
export class RpSceneControlsComponent {
  readonly phase = input<NarratorPhase>('idle');
  readonly mood = input<SceneMood>('neutral');
  readonly moodChange = output<SceneMood>();

  protected readonly moods = MOODS;

  protected phaseLabel(): string {
    switch (this.phase()) {
      case 'exploring':
        return 'Exploring lore…';
      case 'composing':
        return 'Composing reply…';
      case 'idle':
        return 'Idle';
    }
  }

  protected onMood(event: Event): void {
    this.moodChange.emit(
      (event.target as HTMLSelectElement).value as SceneMood,
    );
  }
}
