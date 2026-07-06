import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

import { LoreEntry } from '../lore.model';
import type { LoreLayer } from '../lore-layer.model';
import type { PromoteLoreEntryRequest } from '../lore-entry-api';
import { LoreEntryDetailsComponent } from '../lore-entry-details/lore-entry-details';
import { LoreEntryListComponent } from '../lore-entry-list/lore-entry-list';

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
  imports: [LoreEntryDetailsComponent, LoreEntryListComponent],
  template: `
    <section class="rp-lorebook">
      <header>
        <h3>Lorebook</h3>
      </header>
      <rp-lore-entry-list
        [entries]="entries()"
        [query]="query()"
        [canonFilter]="canonFilter()"
        [selectedSlug]="selected()?.slug ?? ''"
        [loading]="loading()"
        [errorMessage]="errorMessage()"
        [promoteTargetLayers]="promoteTargetLayers()"
        [promotingEntryId]="promotingEntryId()"
        (queryChange)="setQuery($event)"
        (canonFilterChange)="canonFilter.set($event)"
        (entrySelect)="select($event)"
        (promoteEntry)="promoteEntry.emit($event)"
      />
      <rp-lore-entry-details [entry]="selected()" />
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
      h3 {
        margin: 0;
      }
    `,
  ],
})
export class RpLorebookPanelComponent {
  readonly entries = input.required<readonly LoreEntry[]>();
  readonly loading = input(false);
  readonly errorMessage = input<string | undefined>(undefined);
  readonly selectedEntry = input<LoreEntry | null>(null);
  readonly promoteTargetLayers = input<readonly LoreLayer[]>([]);
  readonly promotingEntryId = input<string | undefined>(undefined);
  readonly queryChange = output<string>();
  readonly selectEntry = output<LoreEntry>();
  readonly promoteEntry = output<PromoteLoreEntryRequest>();

  protected readonly query = signal('');
  protected readonly canonFilter = signal('');
  protected readonly selected = signal<LoreEntry | null>(null);

  constructor() {
    effect(() => {
      this.selected.set(this.selectedEntry());
    });
  }

  protected setQuery(query: string): void {
    this.query.set(query);
    this.queryChange.emit(query);
  }

  protected select(entry: LoreEntry): void {
    this.selected.set(entry);
    this.selectEntry.emit(entry);
  }
}
