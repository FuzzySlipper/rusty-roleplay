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
  DEFAULT_LORE_CONTROLS,
  type LoreControls,
  type LoreEntry,
  type LoreInsertionPosition,
  type LoreRetrievalRole,
} from '../lore.model';

export interface LoreEntryEditRequest {
  readonly title: string;
  readonly body: string;
  readonly tags: readonly string[];
  readonly canonLevel: string;
  readonly loreControls: LoreControls;
}

@Component({
  selector: 'rp-lore-entry-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  template: `
    <form class="editor" (submit)="save($event)">
      <label>
        Title
        <input
          name="title"
          [value]="draft().title"
          (input)="updateDraft('title', inputValue($event))"
        />
      </label>
      <label>
        Body
        <textarea
          name="body"
          rows="6"
          [value]="draft().body"
          (input)="updateDraft('body', inputValue($event))"
        ></textarea>
      </label>
      <label>
        Tags
        <input
          name="tags"
          [value]="draftTags()"
          (input)="setTags(inputValue($event))"
        />
      </label>
      <label>
        Canon
        <select
          name="canonLevel"
          [value]="draft().canonLevel"
          (change)="updateDraft('canonLevel', inputValue($event))"
        >
          <option value="established">Established</option>
          <option value="speculative">Speculative</option>
          <option value="superseded">Superseded</option>
          <option value="retired">Retired</option>
        </select>
      </label>
      <details class="advanced">
        <summary rvTooltip="Show trigger keys and insertion controls">
          Advanced triggers
        </summary>
        <div class="advanced-grid">
          <label>
            Primary keys
            <input
              name="primaryKeys"
              rvTooltip="Comma-separated terms that should activate this lore entry"
              [value]="draft().loreControls.primaryKeys.join(', ')"
              (input)="setControlList('primaryKeys', inputValue($event))"
            />
          </label>
          <label>
            Secondary keys
            <input
              name="secondaryKeys"
              rvTooltip="Optional comma-separated terms that further narrow activation"
              [value]="draft().loreControls.secondaryKeys.join(', ')"
              (input)="setControlList('secondaryKeys', inputValue($event))"
            />
          </label>
          <label>
            Scan depth
            <input
              name="scanDepth"
              type="number"
              min="0"
              max="200"
              rvTooltip="How far back matching should scan when supported"
              [value]="draft().loreControls.scanDepth"
              (input)="setNumberControl('scanDepth', inputValue($event))"
            />
          </label>
          <label>
            Position
            <select
              name="insertionPosition"
              rvTooltip="Where this lore prefers to appear in the assembled prompt"
              [value]="draft().loreControls.insertionPosition"
              (change)="
                setStringControl(
                  'insertionPosition',
                  inputValue($event) || 'lore_block'
                )
              "
            >
              <option value="lore_block">Lore block</option>
              <option value="system">System</option>
              <option value="before_history">Before history</option>
              <option value="after_history">After history</option>
              <option value="before_author_note">Before author note</option>
              <option value="after_author_note">After author note</option>
            </select>
          </label>
          <label>
            Order
            <input
              name="insertionOrder"
              type="number"
              rvTooltip="Lower values are inserted earlier among supported layer entries"
              [value]="draft().loreControls.insertionOrder"
              (input)="setNumberControl('insertionOrder', inputValue($event))"
            />
          </label>
          <label>
            Probability
            <input
              name="probability"
              type="number"
              min="0"
              max="1"
              step="0.05"
              rvTooltip="Chance this lore should activate when probability is supported"
              [value]="draft().loreControls.probability"
              (input)="setNumberControl('probability', inputValue($event))"
            />
          </label>
          <label>
            Retrieval role
            <select
              name="retrievalRole"
              rvTooltip="Prompt role to prefer when retrieval roles are supported"
              [value]="draft().loreControls.retrievalRole"
              (change)="
                setStringControl(
                  'retrievalRole',
                  inputValue($event) || 'system'
                )
              "
            >
              <option value="system">System</option>
              <option value="narrator">Narrator</option>
              <option value="user">User</option>
              <option value="assistant">Assistant</option>
            </select>
          </label>
          <label class="check">
            <input
              name="enabled"
              type="checkbox"
              rvTooltip="Keep this lore entry available to matching"
              [checked]="draft().loreControls.enabled"
              (change)="setBooleanControl('enabled', checkedValue($event))"
            />
            Enabled
          </label>
          <label class="check">
            <input
              name="constant"
              type="checkbox"
              rvTooltip="Always include this layer entry during current recall support"
              [checked]="draft().loreControls.constant"
              (change)="setBooleanControl('constant', checkedValue($event))"
            />
            Always on
          </label>
        </div>
      </details>
      <button
        type="submit"
        [disabled]="disabled()"
        rvTooltip="Save lore entry changes when editing is available"
      >
        Save
      </button>
    </form>
  `,
  styles: [
    `
      .editor {
        display: grid;
        gap: var(--rv-space-sm, 6px);
      }

      label {
        display: grid;
        gap: 0.25rem;
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      input,
      textarea,
      select {
        width: 100%;
      }

      .advanced {
        border: 1px solid var(--rv-color-border, #30363d);
        padding: 0.5rem;
      }

      summary {
        cursor: pointer;
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .advanced-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
        gap: var(--rv-space-sm, 6px);
        margin-top: 0.5rem;
      }

      .check {
        align-content: end;
        grid-template-columns: auto 1fr;
        align-items: center;
      }

      .check input {
        width: auto;
      }
    `,
  ],
})
export class LoreEntryEditorComponent {
  readonly entry = input<LoreEntry | null>(null);
  readonly disabled = input(false);
  readonly entrySave = output<LoreEntryEditRequest>();

  protected readonly draft = signal<LoreEntryEditRequest>({
    title: '',
    body: '',
    tags: [],
    canonLevel: 'established',
    loreControls: DEFAULT_LORE_CONTROLS,
  });

  protected readonly draftTags = computed(() => this.draft().tags.join(', '));

  constructor() {
    effect(() => {
      const entry = this.entry();
      this.draft.set({
        title: entry?.title ?? '',
        body: entry?.body ?? '',
        tags: entry?.tags ?? [],
        canonLevel: entry?.canonLevel ?? 'established',
        loreControls: entry?.loreControls ?? DEFAULT_LORE_CONTROLS,
      });
    });
  }

  protected updateDraft(
    key: 'title' | 'body' | 'canonLevel',
    value: string,
  ): void {
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  protected setControlList(
    key: 'primaryKeys' | 'secondaryKeys',
    value: string,
  ): void {
    this.updateControls({
      [key]: value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    });
  }

  protected setStringControl(
    key: 'insertionPosition' | 'retrievalRole',
    value: string,
  ): void {
    if (key === 'insertionPosition') {
      this.updateControls({
        insertionPosition: value as LoreInsertionPosition,
      });
      return;
    }
    this.updateControls({ retrievalRole: value as LoreRetrievalRole });
  }

  protected setNumberControl(
    key: 'scanDepth' | 'insertionOrder' | 'probability',
    value: string,
  ): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    this.updateControls({ [key]: parsed });
  }

  protected setBooleanControl(
    key: 'enabled' | 'constant',
    value: boolean,
  ): void {
    this.updateControls({ [key]: value });
  }

  protected setTags(value: string): void {
    this.draft.update((draft) => ({
      ...draft,
      tags: value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    }));
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.disabled()) {
      this.entrySave.emit(this.draft());
    }
  }

  protected inputValue(event: Event): string {
    return (
      event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    ).value;
  }

  protected checkedValue(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  private updateControls(patch: Partial<LoreControls>): void {
    this.draft.update((draft) => ({
      ...draft,
      loreControls: {
        ...draft.loreControls,
        ...patch,
      },
    }));
  }
}
