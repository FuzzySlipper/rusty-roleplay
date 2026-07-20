import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { TooltipDirective } from '@rusty-view/chat-components';

import {
  DEFAULT_NARRATOR_CONFIG,
  NARRATOR_EXPLICITNESS,
  NARRATOR_MEMORY_DEPTHS,
  NARRATOR_PACING,
  NARRATOR_TONES,
  buildNarratorStylePrompt,
  type NarratorConfig,
  type NarratorExplicitness,
  type NarratorMemoryDepth,
  type NarratorPacing,
  type NarratorReviewSettings,
  type NarratorTone,
} from './narrator-config.model';

@Component({
  selector: 'app-narrator-config-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  template: `
    <section class="narrator">
      <header>
        <h3>Narrator</h3>
        <button
          type="button"
          rvTooltip="Reload the narrator config from the selected profile"
          rvTooltipPlacement="bottom"
          (click)="configReload.emit()"
          [disabled]="loading()"
        >
          Reload
        </button>
      </header>

      @if (loading()) {
        <p class="state">Loading narrator config...</p>
      } @else if (errorMessage()) {
        <p class="state error">{{ errorMessage() }}</p>
      }

      <form (submit)="save($event)">
        <div class="grid">
          <label>
            Tone
            <select [value]="draft().tone" (change)="setTone($event)">
              @for (tone of tones; track tone) {
                <option [value]="tone">{{ label(tone) }}</option>
              }
            </select>
          </label>

          <label>
            Pacing
            <select [value]="draft().pacing" (change)="setPacing($event)">
              @for (item of pacing; track item) {
                <option [value]="item">{{ label(item) }}</option>
              }
            </select>
          </label>

          <label>
            Explicitness
            <select
              [value]="draft().explicitness"
              (change)="setExplicitness($event)"
            >
              @for (item of explicitness; track item) {
                <option [value]="item">{{ label(item) }}</option>
              }
            </select>
          </label>

          <label>
            Memory
            <select
              [value]="draft().memoryDepth"
              (change)="setMemoryDepth($event)"
            >
              @for (item of memoryDepths; track item) {
                <option [value]="item">{{ label(item) }}</option>
              }
            </select>
          </label>
        </div>

        <label class="prompt-field">
          Style prompt
          <textarea
            rows="9"
            [value]="draft().stylePrompt"
            (input)="setStylePrompt($event)"
          ></textarea>
        </label>

        <label class="prompt-field exemplar-field">
          Exemplar / reference prose
          <textarea
            rows="4"
            [value]="draft().exemplar"
            (input)="setExemplar($event)"
          ></textarea>
        </label>

        <div class="prompt-actions">
          <button
            type="button"
            rvTooltip="Regenerate the style prompt from the current controls"
            rvTooltipPlacement="bottom"
            (click)="rebuildPrompt()"
          >
            Rebuild prompt
          </button>
        </div>

        <fieldset>
          <legend>Review before final answer</legend>
          <label class="check">
            <input
              type="checkbox"
              [checked]="draft().review.enabled"
              (change)="setReviewBoolean('enabled', $event)"
            />
            Run narrator review pass before sending
          </label>

          <label>
            Max review cycles
            <input
              type="number"
              min="0"
              max="8"
              step="1"
              [value]="draft().review.maxReviewCycles"
              (input)="setMaxReviewCycles($event)"
            />
          </label>

          <div class="checks">
            <label class="check">
              <input
                type="checkbox"
                [checked]="draft().review.checkGravityDrift"
                (change)="setReviewBoolean('checkGravityDrift', $event)"
              />
              Scene logic / stakes
            </label>
            <label class="check">
              <input
                type="checkbox"
                [checked]="draft().review.checkCharacterVoice"
                (change)="setReviewBoolean('checkCharacterVoice', $event)"
              />
              Character voice
            </label>
            <label class="check">
              <input
                type="checkbox"
                [checked]="draft().review.checkContinuity"
                (change)="setReviewBoolean('checkContinuity', $event)"
              />
              Continuity
            </label>
          </div>
        </fieldset>

        <div class="actions">
          <button
            type="button"
            rvTooltip="Discard unsaved narrator prompt and review changes"
            rvTooltipPlacement="top"
            (click)="resetDraft()"
            [disabled]="!dirty()"
          >
            Reset
          </button>
          <button
            type="submit"
            rvTooltip="Save narrator settings for the next wake"
            rvTooltipPlacement="top"
            [disabled]="saving() || !dirty()"
          >
            Save
          </button>
        </div>
      </form>
    </section>
  `,
  styles: [
    `
      .narrator {
        display: grid;
        gap: 0.65rem;
      }

      header,
      .actions,
      .prompt-actions,
      .checks {
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }

      header {
        justify-content: space-between;
      }

      h3,
      p {
        margin: 0;
      }

      form,
      .grid,
      fieldset {
        display: grid;
        gap: 0.55rem;
      }

      .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      label {
        display: grid;
        gap: 0.25rem;
        color: var(--rv-color-text-secondary, #48515d);
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .check {
        display: flex;
        align-items: center;
      }

      select,
      input,
      textarea,
      button {
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface, #fff);
        color: var(--rv-color-text-primary, #1b1f24);
        font: inherit;
      }

      select,
      input,
      button {
        min-height: var(--rv-density-control-md, 30px);
      }

      select,
      input,
      textarea {
        width: 100%;
        padding: 0.35rem 0.45rem;
      }

      textarea {
        resize: vertical;
      }

      fieldset {
        margin: 0;
        padding: 0.65rem;
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
      }

      legend {
        color: var(--rv-color-text-primary, #1b1f24);
        font-size: var(--rv-font-size-sm, 0.8125rem);
        font-weight: var(--rv-font-weight-bold, 600);
      }

      button {
        padding: 0 0.6rem;
        cursor: pointer;
      }

      button:disabled {
        cursor: default;
        opacity: 0.55;
      }

      .actions {
        justify-content: flex-end;
      }

      .prompt-actions {
        justify-content: flex-start;
      }

      .prompt-field textarea {
        min-height: 12rem;
        font-family: var(
          --rv-font-mono,
          ui-monospace,
          SFMono-Regular,
          monospace
        );
        line-height: 1.45;
      }

      .exemplar-field textarea {
        min-height: 5rem;
      }

      .state {
        color: var(--rv-color-text-muted, #7a828d);
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .error {
        color: var(--rv-color-danger, #cf222e);
      }
    `,
  ],
})
export class NarratorConfigPanelComponent {
  readonly config = input<NarratorConfig | null>(null);
  readonly loading = input(false);
  readonly saving = input(false);
  readonly errorMessage = input<string | undefined>(undefined);

  readonly configReload = output<void>();
  readonly configSave = output<NarratorConfig>();

  protected readonly tones = NARRATOR_TONES;
  protected readonly pacing = NARRATOR_PACING;
  protected readonly explicitness = NARRATOR_EXPLICITNESS;
  protected readonly memoryDepths = NARRATOR_MEMORY_DEPTHS;
  protected readonly draft = signal<NarratorConfig>(
    cloneConfig(DEFAULT_NARRATOR_CONFIG),
  );
  private readonly promptEdited = signal(false);
  protected readonly dirty = computed(
    () =>
      JSON.stringify(this.draft()) !==
      JSON.stringify(
        withPrompt(cloneConfig(this.config() ?? DEFAULT_NARRATOR_CONFIG)),
      ),
  );

  constructor() {
    effect(() => {
      const next = cloneConfig(this.config() ?? DEFAULT_NARRATOR_CONFIG);
      this.draft.set(withPrompt(next));
      this.promptEdited.set(next.stylePrompt.trim().length > 0);
    });
  }

  protected setTone(event: Event): void {
    this.patchFromControl({ tone: inputValue(event) as NarratorTone });
  }

  protected setPacing(event: Event): void {
    this.patchFromControl({ pacing: inputValue(event) as NarratorPacing });
  }

  protected setExplicitness(event: Event): void {
    this.patchFromControl({
      explicitness: inputValue(event) as NarratorExplicitness,
    });
  }

  protected setMemoryDepth(event: Event): void {
    this.patchFromControl({
      memoryDepth: inputValue(event) as NarratorMemoryDepth,
    });
  }

  protected setStylePrompt(event: Event): void {
    this.promptEdited.set(true);
    this.patch({ stylePrompt: inputValue(event) });
  }

  protected setExemplar(event: Event): void {
    this.patch({ exemplar: inputValue(event) });
  }

  protected rebuildPrompt(): void {
    this.promptEdited.set(false);
    this.draft.update((current) => ({
      ...current,
      stylePrompt: buildNarratorStylePrompt(current),
    }));
  }

  protected setMaxReviewCycles(event: Event): void {
    const parsed = Number(inputValue(event));
    const maxReviewCycles = Number.isFinite(parsed)
      ? Math.min(8, Math.max(0, Math.trunc(parsed)))
      : 0;
    this.patchReviewFromControl({ maxReviewCycles });
  }

  protected setReviewBoolean(
    key: keyof Omit<NarratorReviewSettings, 'maxReviewCycles'>,
    event: Event,
  ): void {
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.patchReviewFromControl({ [key]: checked });
  }

  protected resetDraft(): void {
    const next = cloneConfig(this.config() ?? DEFAULT_NARRATOR_CONFIG);
    this.draft.set(withPrompt(next));
    this.promptEdited.set(next.stylePrompt.trim().length > 0);
  }

  protected save(event: Event): void {
    event.preventDefault();
    if (this.dirty()) {
      this.configSave.emit(cloneConfig(this.draft()));
    }
  }

  protected label(value: string): string {
    return value.replace(/_/g, ' ');
  }

  private patch(patch: Partial<NarratorConfig>): void {
    this.draft.update((current) => ({ ...current, ...patch }));
  }

  private patchFromControl(patch: Partial<NarratorConfig>): void {
    this.draft.update((current) => {
      const next = { ...current, ...patch };
      return this.promptEdited()
        ? next
        : { ...next, stylePrompt: buildNarratorStylePrompt(next) };
    });
  }

  private patchReview(patch: Partial<NarratorReviewSettings>): void {
    this.draft.update((current) => ({
      ...current,
      review: { ...current.review, ...patch },
    }));
  }

  private patchReviewFromControl(patch: Partial<NarratorReviewSettings>): void {
    this.draft.update((current) => {
      const next = {
        ...current,
        review: { ...current.review, ...patch },
      };
      return this.promptEdited()
        ? next
        : { ...next, stylePrompt: buildNarratorStylePrompt(next) };
    });
  }
}

function cloneConfig(config: NarratorConfig): NarratorConfig {
  return {
    ...config,
    review: { ...config.review },
  };
}

function withPrompt(config: NarratorConfig): NarratorConfig {
  if (config.stylePrompt.trim().length > 0) return config;
  return { ...config, stylePrompt: buildNarratorStylePrompt(config) };
}

function inputValue(event: Event): string {
  return (
    (event.target as HTMLInputElement | HTMLSelectElement | null)?.value ?? ''
  );
}
