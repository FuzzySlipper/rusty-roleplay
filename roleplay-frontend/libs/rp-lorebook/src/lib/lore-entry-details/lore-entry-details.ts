import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { LoreEntry } from '../lore.model';

@Component({
  selector: 'rp-lore-entry-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entry(); as lore) {
      <article class="details">
        <header>
          <h4>{{ lore.title }}</h4>
          <span class="canon" [attr.data-canon]="lore.canonLevel">{{
            lore.canonLevel
          }}</span>
        </header>
        <p class="body">{{ lore.body || lore.summary }}</p>
        @if (lore.tags.length > 0) {
          <div class="tags" aria-label="Lore tags">
            @for (tag of lore.tags; track tag) {
              <span>{{ tag }}</span>
            }
          </div>
        }
        <dl>
          <div>
            <dt>Captured by</dt>
            <dd>{{ lore.capturedBy || 'Unknown' }}</dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{{ lore.captureReason || 'Not recorded' }}</dd>
          </div>
          <div>
            <dt>Captured at</dt>
            <dd>{{ lore.capturedAt || 'Not recorded' }}</dd>
          </div>
          @if (lore.supersedesRecordId) {
            <div>
              <dt>Previous</dt>
              <dd>{{ lore.supersedesRecordId }}</dd>
            </div>
          }
          @if (lore.supersededByRecordId) {
            <div>
              <dt>Next</dt>
              <dd>{{ lore.supersededByRecordId }}</dd>
            </div>
          }
        </dl>
      </article>
    } @else {
      <p class="empty">Select a lore entry to inspect it.</p>
    }
  `,
  styles: [
    `
      .details {
        display: grid;
        gap: var(--rv-space-sm, 6px);
      }

      header {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 0.5rem;
      }

      h4,
      .body,
      .empty,
      dl {
        margin: 0;
      }

      h4,
      .body,
      dd {
        overflow-wrap: anywhere;
      }

      .canon,
      .tags span {
        font-size: var(--rv-font-size-xs, 0.75rem);
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
      }

      .tags span {
        padding: 0.125rem 0.35rem;
        border: 1px solid var(--rv-color-border, #30363d);
      }

      dl {
        display: grid;
        gap: 0.35rem;
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      dt {
        opacity: 0.7;
      }

      dd {
        margin: 0;
      }

      .empty {
        opacity: 0.7;
      }
    `,
  ],
})
export class LoreEntryDetailsComponent {
  readonly entry = input<LoreEntry | null>(null);
}
