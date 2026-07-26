import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { RoleplayWorkbench } from '../roleplay-workbench';
import { ImageGenerationApi } from './image-generation-api';
import {
  ROLEPLAY_IMAGE_MODES,
  type GeneratedImage,
  type ImageGenerationPresetSummary,
  type RoleplayImageMode,
} from './image-generation.model';
import { buildRoleplayImagePrompt } from './image-generation-prompt';
import {
  loadImageModePreference,
  saveImageModePreference,
} from './image-generation-settings';

type ImageAspect = 'square' | 'portrait' | 'landscape';

@Component({
  selector: 'app-image-generation-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="image-generation">
      <header>
        <div>
          <h3>Images</h3>
          <p>
            Generate through an approved Crew preset. Workflow graphs and
            provider credentials stay on the server.
          </p>
        </div>
        <button type="button" (click)="reload()" [disabled]="loading()">
          Refresh
        </button>
      </header>

      @if (loading()) {
        <p class="state">Loading image presets and gallery…</p>
      } @else if (presets().length === 0) {
        <p class="state">
          No image-generation presets are configured for this Crew service.
        </p>
      } @else {
        <form (submit)="generate($event)">
          <fieldset>
            <legend>What to illustrate</legend>
            <div class="mode-grid">
              @for (item of modes; track item.id) {
                <button
                  type="button"
                  class="mode"
                  [class.active]="mode() === item.id"
                  [attr.aria-pressed]="mode() === item.id"
                  (click)="selectMode(item.id)"
                >
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.description }}</span>
                </button>
              }
            </div>
          </fieldset>

          <div class="control-grid">
            <label>
              Workflow preset
              <select
                [value]="selectedPresetId()"
                (change)="selectPreset(readSelect($event))"
              >
                @for (preset of presets(); track preset.id) {
                  <option [value]="preset.id">
                    {{ preset.id }} · {{ preset.version }}
                  </option>
                }
              </select>
            </label>

            <label>
              Style
              <select
                [value]="selectedStyle() ?? ''"
                (change)="setStyle(readSelect($event))"
              >
                <option value="">Preset default</option>
                @for (style of selectedPreset()?.styles ?? []; track style) {
                  <option [value]="style">{{ style }}</option>
                }
              </select>
            </label>

            <label>
              Seed
              <input
                type="number"
                min="0"
                max="4294967295"
                placeholder="Random"
                [value]="seed() ?? ''"
                (input)="setSeed($event)"
              />
            </label>

            <label>
              Steps
              <input
                type="number"
                [min]="selectedPreset()?.limits?.minSteps ?? 1"
                [max]="selectedPreset()?.limits?.maxSteps ?? 1000"
                [value]="steps()"
                (input)="setSteps($event)"
              />
            </label>
          </div>

          <div class="aspect-row" aria-label="Image aspect">
            <span>Aspect</span>
            <button type="button" (click)="setAspect('square')">Square</button>
            <button type="button" (click)="setAspect('portrait')">
              Portrait
            </button>
            <button type="button" (click)="setAspect('landscape')">
              Landscape
            </button>
            <label>
              Width
              <input
                type="number"
                step="64"
                [min]="selectedPreset()?.limits?.minWidth ?? 64"
                [max]="selectedPreset()?.limits?.maxWidth ?? 16384"
                [value]="width()"
                (input)="setWidth($event)"
              />
            </label>
            <label>
              Height
              <input
                type="number"
                step="64"
                [min]="selectedPreset()?.limits?.minHeight ?? 64"
                [max]="selectedPreset()?.limits?.maxHeight ?? 16384"
                [value]="height()"
                (input)="setHeight($event)"
              />
            </label>
          </div>

          <label>
            Optional subject or direction
            <input
              type="text"
              [value]="customSubject()"
              (input)="setCustomSubject($event)"
              placeholder="Expression, action, framing, clothing, lighting…"
            />
          </label>

          <label>
            Prompt preview
            <textarea
              rows="12"
              [value]="prompt()"
              (input)="setPrompt($event)"
            ></textarea>
          </label>

          <div class="prompt-actions">
            <button type="button" (click)="rebuildPrompt()">
              Rebuild from roleplay
            </button>
            <span>{{ prompt().length }} characters</span>
          </div>

          <label>
            Negative prompt
            <textarea
              rows="3"
              [value]="negativePrompt()"
              (input)="setNegativePrompt($event)"
            ></textarea>
          </label>

          <label class="check">
            <input
              type="checkbox"
              [checked]="includeInNarratorContext()"
              (change)="setContextVisibility($event)"
            />
            Mark this image for compatible multimodal narrators
          </label>
          <p class="hint">
            Off by default. The image remains visible in chat and Gallery
            without entering normal narrator prompts.
          </p>

          <div class="actions">
            @if (generating()) {
              <button type="button" (click)="cancelGeneration()">
                Cancel request
              </button>
            }
            <button type="submit" [disabled]="!canGenerate() || generating()">
              {{ generating() ? 'Generating…' : 'Generate image' }}
            </button>
          </div>
        </form>
      }

      @if (statusMessage()) {
        <p class="state" aria-live="polite">{{ statusMessage() }}</p>
      }
      @if (errorMessage()) {
        <p class="state error" role="alert">{{ errorMessage() }}</p>
      }

      <section class="gallery">
        <div class="gallery-heading">
          <h3>Gallery</h3>
          <span>{{ gallery().length }} generated images</span>
        </div>
        @if (gallery().length === 0) {
          <p class="state">This session has no generated images yet.</p>
        } @else {
          <div class="gallery-grid">
            @for (image of gallery(); track image.id) {
              <article>
                <a [href]="image.url" target="_blank" rel="noopener noreferrer">
                  <img
                    [src]="image.thumbnailUrl ?? image.url"
                    [alt]="image.filename"
                  />
                </a>
                <div class="image-meta">
                  <strong>{{ image.mode ?? 'Generated image' }}</strong>
                  <span>
                    {{ image.provenance.width ?? image.width ?? '?' }} ×
                    {{ image.provenance.height ?? image.height ?? '?' }}
                  </span>
                  <span>Seed {{ image.provenance.seed ?? 'unknown' }}</span>
                  <span>{{ image.provenance.presetId }}</span>
                </div>
                <details>
                  <summary>Prompt and provenance</summary>
                  <p>{{ image.provenance.prompt }}</p>
                  @if (image.provenance.negativePrompt) {
                    <p>Negative: {{ image.provenance.negativePrompt }}</p>
                  }
                  <p>
                    {{ image.provenance.adapter ?? 'provider' }} ·
                    {{ image.provenance.providerJobId ?? 'job unavailable' }}
                  </p>
                </details>
                <button
                  type="button"
                  (click)="regenerate(image)"
                  [disabled]="generating()"
                >
                  Regenerate with new seed
                </button>
              </article>
            }
          </div>
        }
      </section>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .image-generation,
    form,
    fieldset,
    .gallery {
      display: grid;
      gap: 0.75rem;
    }

    header,
    .actions,
    .prompt-actions,
    .gallery-heading,
    .aspect-row {
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }

    header,
    .gallery-heading {
      justify-content: space-between;
    }

    h3,
    p {
      margin: 0;
    }

    header p,
    .hint,
    .state,
    .prompt-actions span,
    .gallery-heading span,
    .image-meta {
      color: var(--rv-color-text-muted, #8b949e);
      font-size: 0.82rem;
    }

    fieldset {
      min-width: 0;
      margin: 0;
      border: 1px solid var(--rv-color-border, #30363d);
      border-radius: var(--rv-radius-md, 8px);
    }

    .mode-grid,
    .control-grid,
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: 0.55rem;
    }

    .mode {
      display: grid;
      gap: 0.2rem;
      min-height: 4rem;
      text-align: left;
    }

    .mode span {
      color: var(--rv-color-text-muted, #8b949e);
      font-size: 0.75rem;
    }

    .mode.active {
      border-color: var(--rv-color-accent, #58a6ff);
      background: color-mix(
        in srgb,
        var(--rv-color-accent, #58a6ff) 14%,
        transparent
      );
    }

    label {
      display: grid;
      gap: 0.25rem;
      min-width: 0;
      font-size: 0.82rem;
    }

    input,
    select,
    textarea,
    button {
      box-sizing: border-box;
      max-width: 100%;
      font: inherit;
    }

    input,
    select,
    textarea {
      width: 100%;
      padding: 0.45rem 0.55rem;
      color: inherit;
      border: 1px solid var(--rv-color-border, #30363d);
      border-radius: var(--rv-radius-sm, 5px);
      background: var(--rv-color-surface, #161b22);
    }

    textarea {
      resize: vertical;
    }

    .aspect-row {
      flex-wrap: wrap;
    }

    .aspect-row label {
      grid-template-columns: auto 6rem;
      align-items: center;
    }

    .check {
      display: flex;
      align-items: center;
    }

    .check input {
      width: auto;
    }

    .actions,
    .prompt-actions {
      justify-content: flex-end;
    }

    .state.error {
      color: var(--rv-color-danger, #f85149);
    }

    .gallery {
      padding-top: 0.75rem;
      border-top: 1px solid var(--rv-color-border, #30363d);
    }

    .gallery-grid article {
      display: grid;
      align-content: start;
      gap: 0.45rem;
      min-width: 0;
      padding: 0.55rem;
      border: 1px solid var(--rv-color-border, #30363d);
      border-radius: var(--rv-radius-md, 8px);
    }

    .gallery-grid img {
      display: block;
      width: 100%;
      max-height: 18rem;
      object-fit: contain;
      border-radius: var(--rv-radius-sm, 5px);
      background: #090c10;
    }

    .image-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.2rem 0.5rem;
    }

    details p {
      margin-top: 0.4rem;
      overflow-wrap: anywhere;
      font-size: 0.78rem;
    }
  `,
})
export class ImageGenerationPanelComponent {
  private readonly api = inject(ImageGenerationApi);
  protected readonly workbench = inject(RoleplayWorkbench);

  protected readonly modes = ROLEPLAY_IMAGE_MODES;
  protected readonly presets = signal<readonly ImageGenerationPresetSummary[]>(
    [],
  );
  protected readonly gallery = signal<readonly GeneratedImage[]>([]);
  protected readonly mode = signal<RoleplayImageMode>('scene');
  protected readonly selectedPresetId = signal('');
  protected readonly selectedStyle = signal<string | undefined>(undefined);
  protected readonly customSubject = signal('');
  protected readonly prompt = signal('');
  protected readonly negativePrompt = signal('');
  protected readonly seed = signal<number | undefined>(undefined);
  protected readonly width = signal(1024);
  protected readonly height = signal(1024);
  protected readonly steps = signal(20);
  protected readonly includeInNarratorContext = signal(false);
  protected readonly loading = signal(false);
  protected readonly generating = signal(false);
  protected readonly errorMessage = signal<string | undefined>(undefined);
  protected readonly statusMessage = signal<string | undefined>(undefined);
  private readonly selectedSessionId = signal<string | undefined>(undefined);
  private generationController: AbortController | undefined;

  protected readonly selectedPreset = computed(() =>
    this.presets().find((preset) => preset.id === this.selectedPresetId()),
  );
  protected readonly canGenerate = computed(() => {
    const preset = this.selectedPreset();
    return (
      this.workbench.chatStore.activeSessionId() !== null &&
      preset !== undefined &&
      this.prompt().trim().length > 0 &&
      this.prompt().length <= preset.limits.maxPromptChars &&
      this.width() >= preset.limits.minWidth &&
      this.width() <= preset.limits.maxWidth &&
      this.height() >= preset.limits.minHeight &&
      this.height() <= preset.limits.maxHeight &&
      this.steps() >= preset.limits.minSteps &&
      this.steps() <= preset.limits.maxSteps
    );
  });

  constructor() {
    effect(() => {
      const sessionId = this.workbench.chatStore.activeSessionId() ?? undefined;
      if (sessionId === this.selectedSessionId()) return;
      this.selectedSessionId.set(sessionId);
      queueMicrotask(() => {
        void this.loadForSession(sessionId);
      });
    });
  }

  protected reload(): void {
    void this.loadForSession(
      this.workbench.chatStore.activeSessionId() ?? undefined,
    );
  }

  protected selectMode(mode: RoleplayImageMode): void {
    this.savePreference();
    this.mode.set(mode);
    this.applyPreference();
    this.rebuildPrompt();
  }

  protected selectPreset(presetId: string): void {
    const preset = this.presets().find(
      (candidate) => candidate.id === presetId,
    );
    if (preset === undefined) return;
    this.applyPreset(preset);
    this.savePreference();
  }

  protected setStyle(style: string): void {
    this.selectedStyle.set(style || undefined);
    this.savePreference();
  }

  protected setAspect(aspect: ImageAspect): void {
    const preset = this.selectedPreset();
    if (preset === undefined) return;
    const dimensions =
      aspect === 'portrait'
        ? { width: 832, height: 1216 }
        : aspect === 'landscape'
          ? { width: 1216, height: 832 }
          : { width: 1024, height: 1024 };
    this.width.set(
      clamp(dimensions.width, preset.limits.minWidth, preset.limits.maxWidth),
    );
    this.height.set(
      clamp(
        dimensions.height,
        preset.limits.minHeight,
        preset.limits.maxHeight,
      ),
    );
  }

  protected setCustomSubject(event: Event): void {
    this.customSubject.set(readInput(event).value);
  }

  protected setPrompt(event: Event): void {
    this.prompt.set(readInput(event).value);
  }

  protected setNegativePrompt(event: Event): void {
    this.negativePrompt.set(readInput(event).value);
    this.savePreference();
  }

  protected setSeed(event: Event): void {
    this.seed.set(readOptionalNumber(event));
  }

  protected setWidth(event: Event): void {
    this.width.set(readNumber(event, this.width()));
  }

  protected setHeight(event: Event): void {
    this.height.set(readNumber(event, this.height()));
  }

  protected setSteps(event: Event): void {
    this.steps.set(readNumber(event, this.steps()));
  }

  protected setContextVisibility(event: Event): void {
    this.includeInNarratorContext.set(readInput(event).checked);
    this.savePreference();
  }

  protected rebuildPrompt(): void {
    const activeCharacterId = this.workbench.activeCharacterId();
    const activePersonaId = this.workbench.activePlayerPersonaId();
    this.prompt.set(
      buildRoleplayImagePrompt({
        mode: this.mode(),
        customSubject: this.customSubject(),
        character: this.workbench
          .characters()
          .find((character) => character.id === activeCharacterId),
        persona: this.workbench
          .playerPersonas()
          .find((persona) => persona.id === activePersonaId),
        sceneLabel: this.workbench.sceneLabel(),
        mood: this.workbench.mood(),
        lore: this.workbench.lore(),
        messages: this.workbench.chatStore.messages(),
      }),
    );
  }

  protected generate(event: Event): void {
    event.preventDefault();
    void this.generateCurrentDraft();
  }

  protected cancelGeneration(): void {
    this.generationController?.abort();
    this.statusMessage.set(
      'Cancellation requested. Refresh Gallery if the provider had already completed.',
    );
  }

  protected regenerate(image: GeneratedImage): void {
    const preset = this.presets().find(
      (candidate) => candidate.id === image.provenance.presetId,
    );
    if (preset === undefined) {
      this.errorMessage.set(
        `Preset ${image.provenance.presetId} is no longer available.`,
      );
      return;
    }
    this.mode.set(image.mode ?? 'custom');
    this.applyPreset(preset);
    this.prompt.set(image.provenance.prompt);
    this.negativePrompt.set(image.provenance.negativePrompt ?? '');
    this.selectedStyle.set(image.provenance.style);
    this.seed.set(undefined);
    this.width.set(image.provenance.width ?? preset.defaults.width);
    this.height.set(image.provenance.height ?? preset.defaults.height);
    this.steps.set(image.provenance.steps ?? preset.defaults.steps);
    this.includeInNarratorContext.set(image.includeInNarratorContext);
    void this.generateCurrentDraft();
  }

  protected readSelect(event: Event): string {
    return readInput(event).value;
  }

  private async loadForSession(sessionId: string | undefined): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(undefined);
    try {
      const [presets, gallery] = await Promise.all([
        this.api.listPresets(),
        sessionId === undefined
          ? Promise.resolve([])
          : this.api.listGallery(sessionId),
      ]);
      this.presets.set(presets);
      this.gallery.set(gallery);
      this.applyPreference();
      if (this.selectedPreset() === undefined && presets[0] !== undefined) {
        this.applyPreset(presets[0]);
      }
      this.rebuildPrompt();
    } catch (error: unknown) {
      this.errorMessage.set(readErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async generateCurrentDraft(): Promise<void> {
    const sessionId = this.workbench.chatStore.activeSessionId();
    const preset = this.selectedPreset();
    if (sessionId === null || preset === undefined || !this.canGenerate()) {
      return;
    }
    this.savePreference();
    this.generating.set(true);
    this.errorMessage.set(undefined);
    this.statusMessage.set('Queued with the configured image provider…');
    const controller = new AbortController();
    this.generationController = controller;
    const anchorMessageId = this.workbench.chatStore.messages().at(-1)?.id;
    const negativePrompt = this.negativePrompt().trim();
    const seed = this.seed();
    const style = this.selectedStyle();
    try {
      await this.api.generate(
        {
          sessionId,
          preset: preset.id,
          prompt: this.prompt().trim(),
          ...(negativePrompt.length === 0 ? {} : { negativePrompt }),
          ...(seed === undefined ? {} : { seed }),
          width: this.width(),
          height: this.height(),
          steps: this.steps(),
          ...(style === undefined ? {} : { style }),
          mode: this.mode(),
          includeInNarratorContext: this.includeInNarratorContext(),
          ...(anchorMessageId === undefined ? {} : { anchorMessageId }),
        },
        controller.signal,
      );
      this.gallery.set(await this.api.listGallery(sessionId));
      if (anchorMessageId !== undefined) {
        await this.workbench.chatStore.selectSession(sessionId);
        this.statusMessage.set(
          'Image completed, linked to the transcript, and saved in Gallery.',
        );
      } else {
        this.statusMessage.set(
          'Image completed and saved in Gallery. Send a roleplay message before generating to place future images inline.',
        );
      }
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        this.statusMessage.set(
          'Generation request cancelled locally. The provider may still finish.',
        );
      } else {
        this.errorMessage.set(readErrorMessage(error));
        this.statusMessage.set(undefined);
      }
    } finally {
      if (this.generationController === controller) {
        this.generationController = undefined;
      }
      this.generating.set(false);
    }
  }

  private applyPreference(): void {
    const profileId = this.workbench.activeProfile()?.id;
    if (profileId === undefined) return;
    const preference = loadImageModePreference(profileId, this.mode());
    this.includeInNarratorContext.set(preference.includeInNarratorContext);
    this.negativePrompt.set(preference.negativePrompt);
    const preferredPreset = this.presets().find(
      (preset) => preset.id === preference.presetId,
    );
    if (preferredPreset !== undefined) {
      this.applyPreset(preferredPreset);
    }
    const preset = this.selectedPreset();
    this.selectedStyle.set(
      preset?.styles.includes(preference.style ?? '')
        ? preference.style
        : undefined,
    );
  }

  private applyPreset(preset: ImageGenerationPresetSummary): void {
    this.selectedPresetId.set(preset.id);
    this.width.set(preset.defaults.width);
    this.height.set(preset.defaults.height);
    this.steps.set(preset.defaults.steps);
    this.negativePrompt.set(
      this.negativePrompt() || preset.defaults.negativePrompt || '',
    );
    const selectedStyle = this.selectedStyle();
    if (selectedStyle !== undefined && !preset.styles.includes(selectedStyle)) {
      this.selectedStyle.set(undefined);
    }
  }

  private savePreference(): void {
    const profileId = this.workbench.activeProfile()?.id;
    if (profileId === undefined) return;
    saveImageModePreference(profileId, this.mode(), {
      includeInNarratorContext: this.includeInNarratorContext(),
      negativePrompt: this.negativePrompt(),
      presetId: this.selectedPresetId() || undefined,
      style: this.selectedStyle(),
    });
  }
}

function readInput(event: Event): HTMLInputElement {
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return target as HTMLInputElement;
  }
  throw new Error('Expected an input event target.');
}

function readOptionalNumber(event: Event): number | undefined {
  const value = readInput(event).value.trim();
  if (value.length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readNumber(event: Event, fallback: number): number {
  return readOptionalNumber(event) ?? fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
