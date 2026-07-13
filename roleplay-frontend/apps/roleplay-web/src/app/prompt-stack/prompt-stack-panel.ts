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
  PromptStackApi,
  type PromptStackPreview,
  type PromptStackTraceEntry,
} from './prompt-stack-api';

@Component({
  selector: 'app-prompt-stack-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  template: `
    <section class="prompt-stack">
      <header>
        <div>
          <h3>Prompt Stack</h3>
          <p>{{ summaryText() }}</p>
        </div>
        <div class="actions">
          <button
            type="button"
            [disabled]="activeSessionId() === undefined || loading()"
            rvTooltip="Load the compiled roleplay prompt stack for the active session"
            (click)="refresh()"
          >
            Refresh
          </button>
          <button
            type="button"
            [disabled]="preview() === null"
            rvTooltip="Show or hide the raw compiled prompt text"
            (click)="showRaw.update(toggleBoolean)"
          >
            {{ showRaw() ? 'Sections' : 'Raw' }}
          </button>
        </div>
      </header>

      @if (activeSessionId() === undefined) {
        <p class="state">Select a session to inspect its prompt stack.</p>
      } @else if (loading()) {
        <p class="state">Loading prompt stack...</p>
      } @else if (errorMessage(); as error) {
        <p class="state error">{{ error }}</p>
      } @else if (preview(); as preview) {
        @if (showRaw()) {
          <pre>{{ preview.compiledText || preview.promptContext }}</pre>
        } @else {
          <div class="section-list">
            @for (section of preview.sections; track section.id) {
              <article>
                <header>
                  <h4>{{ section.title }}</h4>
                  <span>
                    {{ section.tokenEstimate }} tokens ·
                    {{ section.editable ? 'editable' : 'compiled' }} ·
                    {{ section.derived ? 'derived' : 'source' }}
                  </span>
                </header>
                <p>{{ section.body }}</p>
                <small>{{ section.inclusionReason }}</small>
              </article>
            }
          </div>
          <section class="trace">
            <h4>Trace</h4>
            @for (entry of preview.trace; track traceKey(entry)) {
              <dl>
                <div>
                  <dt>Section</dt>
                  <dd>{{ entry.sectionId }}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{{ entry.sourceKind }} / {{ entry.sourceId }}</dd>
                </div>
                <div>
                  <dt>Reason</dt>
                  <dd>{{ entry.inclusionReason }}</dd>
                </div>
              </dl>
            }
          </section>
        }
      } @else {
        <p class="state">Refresh to load the active session prompt stack.</p>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .prompt-stack {
        display: grid;
        gap: var(--rv-space-lg, 16px);
      }

      header {
        align-items: flex-start;
        display: flex;
        gap: var(--rv-space-md, 12px);
        justify-content: space-between;
      }

      h3,
      h4,
      p,
      dl {
        margin: 0;
      }

      h3 {
        font-size: var(--rv-font-size-md, 0.95rem);
      }

      h4 {
        font-size: var(--rv-font-size-sm, 0.84rem);
      }

      header p,
      .state,
      small,
      article header span {
        color: var(--rv-color-text-muted, #9ca3af);
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--rv-space-sm, 8px);
        justify-content: flex-end;
      }

      button {
        border: 1px solid var(--rv-color-border-subtle, #4b5563);
        border-radius: 6px;
        background: var(--rv-color-surface-raised, #20242b);
        color: var(--rv-color-text-primary, #f3f4f6);
        padding: 0.4rem 0.65rem;
        font: inherit;
      }

      button:disabled {
        opacity: 0.55;
      }

      .error {
        color: var(--rv-color-danger, #f87171);
      }

      .section-list {
        display: grid;
        gap: var(--rv-space-md, 12px);
      }

      article {
        border-top: 1px solid var(--rv-color-border-subtle, #4b5563);
        display: grid;
        gap: var(--rv-space-sm, 8px);
        padding-top: var(--rv-space-md, 12px);
      }

      article header {
        align-items: baseline;
      }

      article p {
        line-height: 1.45;
        max-height: 9rem;
        overflow: auto;
        white-space: pre-wrap;
      }

      .trace {
        border-top: 1px solid var(--rv-color-border-subtle, #4b5563);
        display: grid;
        gap: var(--rv-space-sm, 8px);
        padding-top: var(--rv-space-md, 12px);
      }

      .trace dl {
        display: grid;
        gap: var(--rv-space-xs, 4px);
      }

      .trace div {
        display: grid;
        grid-template-columns: minmax(4.5rem, 0.3fr) minmax(0, 1fr);
        gap: var(--rv-space-sm, 8px);
      }

      dt {
        color: var(--rv-color-text-muted, #9ca3af);
      }

      dd {
        margin: 0;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      pre {
        background: var(--rv-color-surface-sunken, #111827);
        border: 1px solid var(--rv-color-border-subtle, #4b5563);
        border-radius: 6px;
        margin: 0;
        max-height: 26rem;
        overflow: auto;
        padding: var(--rv-space-md, 12px);
        white-space: pre-wrap;
      }
    `,
  ],
})
export class PromptStackPanelComponent {
  private readonly api = inject(PromptStackApi);
  private readonly workbench = inject(RoleplayWorkbench);

  protected readonly loading = signal(false);
  protected readonly preview = signal<PromptStackPreview | null>(null);
  protected readonly errorMessage = signal<string | undefined>(undefined);
  protected readonly showRaw = signal(false);
  protected readonly activeSessionId = computed(
    () => this.workbench.chatStore.activeSessionId() ?? undefined,
  );
  protected readonly summaryText = computed(() => {
    const preview = this.preview();
    if (preview === null) {
      return 'Inspectable sections and trace for the active session.';
    }
    return `${preview.sections.length} sections, ${preview.trace.length} trace rows, ${preview.importedPromptBlockCount} imported prompt blocks preserved.`;
  });

  protected refresh(): void {
    void this.loadPromptStack();
  }

  protected traceKey(entry: PromptStackTraceEntry): string {
    return `${entry.sectionId}:${entry.sourceKind}:${entry.sourceId}`;
  }

  protected readonly toggleBoolean = toggleBoolean;

  private async loadPromptStack(): Promise<void> {
    const sessionId = this.activeSessionId();
    if (sessionId === undefined) return;
    this.loading.set(true);
    this.errorMessage.set(undefined);
    try {
      this.preview.set(await this.api.readPromptStack(sessionId));
    } catch (error: unknown) {
      this.errorMessage.set(readErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}

function toggleBoolean(value: boolean): boolean {
  return !value;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
