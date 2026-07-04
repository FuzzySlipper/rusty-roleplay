import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

import { NarratorPhaseIndicatorComponent } from './narrator-phase-indicator';

/**
 * Narrator agent loop phase. The narrator explores lore, then composes the
 * reply (docs/02-narrator-agent-and-loop.md). Surfaced as an indicator so the
 * player can see why a turn is taking time.
 */
export type NarratorPhase =
  | 'idle'
  | 'exploring'
  | 'composing'
  | 'reviewing'
  | 'done';

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
  imports: [NarratorPhaseIndicatorComponent],
  template: `
    <section class="rp-scene-controls">
      <h3>Scene</h3>
      <rp-narrator-phase-indicator [phase]="phase()" />
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
      .rp-scene-controls {
        display: grid;
        gap: 0.65rem;
      }
    `,
  ],
})
export class RpSceneControlsComponent {
  readonly phase = input<NarratorPhase>('idle');
  readonly mood = input<SceneMood>('neutral');
  readonly moodChange = output<SceneMood>();

  protected readonly moods = MOODS;

  protected onMood(event: Event): void {
    this.moodChange.emit(
      (event.target as HTMLSelectElement).value as SceneMood,
    );
  }
}
