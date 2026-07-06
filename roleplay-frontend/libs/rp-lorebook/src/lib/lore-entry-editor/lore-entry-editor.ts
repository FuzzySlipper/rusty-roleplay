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

import type { LoreEntry } from '../lore.model';

export interface LoreEntryEditRequest {
  readonly title: string;
  readonly body: string;
  readonly tags: readonly string[];
  readonly canonLevel: string;
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
      });
    });
  }

  protected updateDraft(
    key: 'title' | 'body' | 'canonLevel',
    value: string,
  ): void {
    this.draft.update((draft) => ({ ...draft, [key]: value }));
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
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
