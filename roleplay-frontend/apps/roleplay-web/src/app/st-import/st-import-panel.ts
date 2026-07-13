import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TooltipDirective } from '@rusty-view/chat-components';

import { RoleplayWorkbench } from '../roleplay-workbench';
import {
  buildStImportPlanFromFiles,
  type StImportPlan,
} from './st-import-planner';
import {
  StPacketImportApi,
  type StPacketImportResult,
} from './st-packet-import-api';

@Component({
  selector: 'app-st-import-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  template: `
    <section class="st-import">
      <div class="import-controls">
        <label
          class="file-picker"
          rvTooltip="Choose a flat ST export packet or a folder with character, persona, lorebook, preset, and transcript files"
        >
          <span>Choose files</span>
          <input
            type="file"
            multiple
            webkitdirectory
            (change)="prepareImport($event)"
          />
        </label>
        <button
          type="button"
          [disabled]="plan() === null || importing()"
          rvTooltip="Import the reviewed packet into rusty-crew roleplay records"
          (click)="importPacket()"
        >
          Import packet
        </button>
      </div>

      @if (errorMessage(); as error) {
        <p class="state error">{{ error }}</p>
      }
      @if (planning()) {
        <p class="state">Reading ST files...</p>
      }
      @if (importing()) {
        <p class="state">Importing into rusty-crew...</p>
      }

      @if (plan(); as plan) {
        <div class="summary-grid">
          <section>
            <h3>Detected</h3>
            <ul class="artifact-list">
              @for (artifact of plan.importSummary.artifacts; track artifact.fileName) {
                <li>
                  <span>{{ artifact.kind }}</span>
                  <strong>{{ artifact.fileName }}</strong>
                </li>
              }
            </ul>
          </section>
          <section>
            <h3>Counts</h3>
            <dl class="counts">
              <div>
                <dt>Characters</dt>
                <dd>{{ plan.importSummary.counts.characters }}</dd>
              </div>
              <div>
                <dt>Personas</dt>
                <dd>{{ plan.importSummary.counts.personas }}</dd>
              </div>
              <div>
                <dt>Lore</dt>
                <dd>{{ plan.importSummary.counts.loreEntries }}</dd>
              </div>
              <div>
                <dt>Messages</dt>
                <dd>{{ plan.importSummary.counts.transcriptRows }}</dd>
              </div>
              <div>
                <dt>Swipe rows</dt>
                <dd>{{ plan.importSummary.counts.assistantVariantRows }}</dd>
              </div>
            </dl>
          </section>
        </div>

        <section class="mapping">
          <h3>Mapping</h3>
          <div class="mapping-columns">
            <div>
              <h4>First class</h4>
              <ul>
                @for (item of plan.importSummary.firstClassFields; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            </div>
            <div>
              <h4>Preserved</h4>
              <ul>
                @for (item of plan.importSummary.preservedMetadata; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            </div>
            <div>
              <h4>Not replayed</h4>
              <ul>
                @for (
                  item of plan.importSummary.notDuplicatedRuntimeCeremony;
                  track item
                ) {
                  <li>{{ item }}</li>
                }
              </ul>
            </div>
          </div>
        </section>
      } @else if (!planning()) {
        <p class="state">
          Select ST files to review how they map into characters, personas, lore,
          sessions, and transcript variants.
        </p>
      }

      @if (result(); as result) {
        <section class="result">
          <h3>Imported</h3>
          <p>
            {{ result.counts.characters }} character,
            {{ result.counts.personas }} persona,
            {{ result.counts.loreEntries }} lore entries,
            {{ result.counts.messages }} messages,
            {{ result.counts.variants }} variants.
          </p>
        </section>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .st-import {
        display: grid;
        gap: var(--rv-space-lg, 16px);
      }

      .import-controls {
        display: flex;
        flex-wrap: wrap;
        gap: var(--rv-space-sm, 8px);
        align-items: center;
      }

      .file-picker {
        position: relative;
        overflow: hidden;
      }

      .file-picker input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }

      button,
      .file-picker {
        border: 1px solid var(--rv-color-border-subtle, #4b5563);
        border-radius: 6px;
        background: var(--rv-color-surface-raised, #20242b);
        color: var(--rv-color-text-primary, #f3f4f6);
        padding: 0.45rem 0.7rem;
        font: inherit;
      }

      button:disabled {
        opacity: 0.55;
      }

      .state {
        margin: 0;
        color: var(--rv-color-text-muted, #9ca3af);
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .error {
        color: var(--rv-color-danger, #f87171);
      }

      .summary-grid,
      .mapping-columns {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
        gap: var(--rv-space-lg, 16px);
      }

      h3,
      h4 {
        margin: 0 0 var(--rv-space-sm, 8px);
        font-size: var(--rv-font-size-md, 0.95rem);
      }

      h4 {
        color: var(--rv-color-text-muted, #9ca3af);
      }

      ul,
      dl {
        margin: 0;
      }

      .artifact-list,
      .mapping ul {
        display: grid;
        gap: var(--rv-space-xs, 4px);
        padding-left: 1rem;
      }

      .artifact-list li {
        display: grid;
        gap: 0.125rem;
      }

      .artifact-list span {
        color: var(--rv-color-text-muted, #9ca3af);
        font-size: var(--rv-font-size-xs, 0.75rem);
      }

      .counts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--rv-space-sm, 8px);
      }

      .counts div {
        min-width: 0;
      }

      .counts dt {
        color: var(--rv-color-text-muted, #9ca3af);
        font-size: var(--rv-font-size-xs, 0.75rem);
      }

      .counts dd {
        margin: 0;
        font-weight: 700;
      }

      .result p {
        margin: 0;
      }
    `,
  ],
})
export class StImportPanelComponent {
  private readonly api = inject(StPacketImportApi);
  private readonly workbench = inject(RoleplayWorkbench);

  protected readonly planning = signal(false);
  protected readonly importing = signal(false);
  protected readonly plan = signal<StImportPlan | null>(null);
  protected readonly result = signal<StPacketImportResult | null>(null);
  protected readonly errorMessage = signal<string | undefined>(undefined);
  protected readonly activeProfile = this.workbench.activeProfile;
  protected readonly canImport = computed(
    () => this.plan() !== null && !this.importing(),
  );

  protected async prepareImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.errorMessage.set(undefined);
    this.result.set(null);
    this.plan.set(null);
    if (files.length === 0) return;
    const profileId = this.activeProfile()?.id;
    if (profileId === undefined) {
      this.errorMessage.set('Select a profile before importing ST files.');
      return;
    }
    this.planning.set(true);
    try {
      this.plan.set(await buildStImportPlanFromFiles(files, { profileId }));
    } catch (error: unknown) {
      this.errorMessage.set(readErrorMessage(error));
    } finally {
      this.planning.set(false);
      input.value = '';
    }
  }

  protected async importPacket(): Promise<void> {
    const plan = this.plan();
    if (plan === null) return;
    this.errorMessage.set(undefined);
    this.importing.set(true);
    try {
      const result = await this.api.importPlan(plan);
      this.result.set(result);
      await this.workbench.refreshAfterStImport(result);
    } catch (error: unknown) {
      this.errorMessage.set(readErrorMessage(error));
    } finally {
      this.importing.set(false);
    }
  }
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
