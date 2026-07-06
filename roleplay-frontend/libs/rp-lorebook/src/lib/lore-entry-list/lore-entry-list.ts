import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { TooltipDirective } from '@rusty-view/chat-components';

import type { LoreEntry } from '../lore.model';
import type { LoreLayer } from '../lore-layer.model';
import type { PromoteLoreEntryRequest } from '../lore-entry-api';
import { LorePromotePopoverComponent } from '../lore-promote-popover/lore-promote-popover';

@Component({
  selector: 'rp-lore-entry-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LorePromotePopoverComponent, TooltipDirective],
  template: `
    <section class="entry-list">
      <header>
        <input
          type="search"
          placeholder="Search lore..."
          [value]="query()"
          rvTooltip="Search lore entries by title or body"
          (input)="setQuery($event)"
        />
        <div class="filters" aria-label="Canon level filters">
          <button
            type="button"
            [class.active]="canonFilter() === ''"
            rvTooltip="Show all canon levels"
            (click)="canonFilterChange.emit('')"
          >
            All {{ entries().length }}
          </button>
          @for (count of canonCounts(); track count.level) {
            <button
              type="button"
              [class.active]="canonFilter() === count.level"
              [attr.data-canon]="count.level"
              rvTooltip="Filter by canon level"
              (click)="canonFilterChange.emit(count.level)"
            >
              {{ count.level }} {{ count.count }}
            </button>
          }
        </div>
      </header>

      @if (loading()) {
        <p class="state">Loading lore...</p>
      } @else if (errorMessage()) {
        <p class="error">{{ errorMessage() }}</p>
      } @else {
        <ul class="entries">
          @for (entry of filteredEntries(); track entry.slug) {
            <li>
              <button
                type="button"
                class="entry"
                [class.selected]="selectedSlug() === entry.slug"
                rvTooltip="Select this lore entry"
                rvTooltipPlacement="right"
                (click)="entrySelect.emit(entry)"
              >
                <span class="title">{{ entry.title }}</span>
                <span class="canon" [attr.data-canon]="entry.canonLevel">{{
                  entry.canonLevel
                }}</span>
                <span class="summary">{{ entry.summary }}</span>
              </button>
              @if (canPromote(entry)) {
                <rp-lore-promote-popover
                  [entryId]="entry.recordId"
                  [sourceLayerId]="entry.sourceLayerId ?? ''"
                  [layers]="promoteTargetLayers()"
                  [loading]="promotingEntryId() === entry.recordId"
                  (promote)="promoteEntry.emit($event)"
                />
              }
            </li>
          } @empty {
            <li class="state">No matching lore.</li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      .entry-list {
        display: grid;
        gap: var(--rv-space-sm, 6px);
        min-width: 0;
      }

      header {
        display: grid;
        gap: var(--rv-space-sm, 6px);
      }

      input {
        width: 100%;
      }

      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
      }

      .filters button {
        font-size: var(--rv-font-size-xs, 0.75rem);
      }

      .filters button.active {
        outline: 1px solid var(--rv-color-accent, #58a6ff);
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

      li {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        gap: var(--rv-space-sm, 6px);
      }

      .entry {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 0.15rem 0.5rem;
        width: 100%;
        text-align: left;
        padding: 0.5rem;
        cursor: pointer;
      }

      .entry.selected {
        outline: 1px solid var(--rv-color-accent, #58a6ff);
      }

      .title {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .canon {
        font-size: 0.75rem;
        opacity: 0.75;
      }

      .summary {
        grid-column: 1 / -1;
        font-size: 0.85rem;
        opacity: 0.85;
        overflow-wrap: anywhere;
      }

      .state,
      .error {
        margin: 0;
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .state {
        opacity: 0.7;
      }

      .error {
        color: var(--rv-color-danger, #cf222e);
      }
    `,
  ],
})
export class LoreEntryListComponent {
  readonly entries = input.required<readonly LoreEntry[]>();
  readonly query = input('');
  readonly canonFilter = input('');
  readonly selectedSlug = input('');
  readonly loading = input(false);
  readonly errorMessage = input<string | undefined>(undefined);
  readonly promoteTargetLayers = input<readonly LoreLayer[]>([]);
  readonly promotingEntryId = input<string | undefined>(undefined);
  readonly queryChange = output<string>();
  readonly canonFilterChange = output<string>();
  readonly entrySelect = output<LoreEntry>();
  readonly promoteEntry = output<PromoteLoreEntryRequest>();

  protected readonly canonCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const entry of this.entries()) {
      counts.set(entry.canonLevel, (counts.get(entry.canonLevel) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([level, count]) => ({ level, count }))
      .sort((left, right) => left.level.localeCompare(right.level));
  });

  protected readonly filteredEntries = computed(() => {
    const filter = this.canonFilter();
    if (!filter) {
      return this.entries();
    }
    return this.entries().filter((entry) => entry.canonLevel === filter);
  });

  protected setQuery(event: Event): void {
    this.queryChange.emit((event.target as HTMLInputElement).value);
  }

  protected canPromote(entry: LoreEntry): boolean {
    return (
      entry.sourceLayerId !== undefined &&
      entry.sourceLayerWritePolicy === 'auto_capture' &&
      this.promoteTargetLayers().some(
        (layer) =>
          layer.layerId !== entry.sourceLayerId &&
          !layer.archived &&
          layer.writePolicy === 'manual',
      )
    );
  }
}
