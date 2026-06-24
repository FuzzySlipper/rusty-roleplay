import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import { LoreEntry } from '../lore.model';

/**
 * Lorebook sidebar panel. Browses and filters lore entries and emits a
 * selection. This is the RP sidebar panel the app mounts through rusty-view's
 * extension slot (the boundary-proof "add one RP sidebar panel" requirement).
 *
 * Presentational: entries come in via input, no service injection. The
 * container feeds it from a lorekeep-backed source in a later task.
 */
@Component({
  selector: 'rp-lorebook-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rp-lorebook">
      <header>
        <h3>Lorebook</h3>
        <input
          type="search"
          placeholder="Search lore…"
          [value]="query()"
          (input)="setQuery($event)"
        />
      </header>
      <ul class="entries">
        @for (entry of filtered(); track entry.slug) {
          <li>
            <button
              type="button"
              class="entry"
              (click)="selectEntry.emit(entry)"
            >
              <span class="title">{{ entry.title }}</span>
              <span class="canon" [attr.data-canon]="entry.canonLevel">{{
                entry.canonLevel
              }}</span>
              <span class="summary">{{ entry.summary }}</span>
            </button>
          </li>
        } @empty {
          <li class="empty">No matching lore.</li>
        }
      </ul>
    </section>
  `,
  styles: [
    `
      .rp-lorebook {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        height: 100%;
      }
      header {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .entries {
        list-style: none;
        padding: 0;
        margin: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .entry {
        display: grid;
        gap: 0.15rem;
        width: 100%;
        text-align: left;
        padding: 0.5rem;
        cursor: pointer;
      }
      .canon {
        font-size: 0.75rem;
        opacity: 0.7;
      }
      .summary {
        font-size: 0.85rem;
        opacity: 0.85;
      }
      .empty {
        opacity: 0.6;
        font-style: italic;
      }
    `,
  ],
})
export class RpLorebookPanelComponent {
  readonly entries = input.required<readonly LoreEntry[]>();
  readonly selectEntry = output<LoreEntry>();

  protected readonly query = signal('');

  protected readonly filtered = computed<readonly LoreEntry[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) {
      return this.entries();
    }
    return this.entries().filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    );
  });

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
