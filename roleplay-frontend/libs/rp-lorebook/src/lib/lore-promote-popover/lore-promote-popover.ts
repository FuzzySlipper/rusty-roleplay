import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { TooltipDirective } from '@rusty-view/chat-components';

import type { LoreLayer } from '../lore-layer.model';
import type { PromoteLoreEntryRequest } from '../lore-entry-api';

@Component({
  selector: 'rp-lore-promote-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  template: `
    <div class="promote">
      <button
        type="button"
        class="trigger"
        [disabled]="loading() || targetLayers().length === 0"
        rvTooltip="Promote this captured fact into a durable lore layer"
        (click)="open.update((value) => !value)"
      >
        Promote
      </button>

      @if (open()) {
        <section class="panel" aria-label="Promote lore entry">
          @if (targetLayers().length > 0) {
            <ul>
              @for (layer of targetLayers(); track layer.layerId) {
                <li>
                  <button
                    type="button"
                    [class.selected]="layer.layerId === selectedLayerId()"
                    rvTooltip="Choose this target layer"
                    (click)="selectedLayerId.set(layer.layerId)"
                  >
                    <span>{{ layer.name }}</span>
                    <span class="purpose">{{ layer.purpose }}</span>
                  </button>
                </li>
              }
            </ul>
            <div class="actions">
              <button
                type="button"
                rvTooltip="Close the promote menu"
                (click)="open.set(false)"
              >
                Cancel
              </button>
              <button
                type="button"
                [disabled]="selectedLayerId() === undefined || loading()"
                rvTooltip="Promote this entry to the selected layer"
                (click)="confirm()"
              >
                {{ loading() ? 'Promoting...' : 'Confirm' }}
              </button>
            </div>
          } @else {
            <p>No writable target layers.</p>
          }
        </section>
      }
    </div>
  `,
  styles: [
    `
      .promote {
        position: relative;
        display: inline-block;
      }

      .trigger {
        font-size: var(--rv-font-size-xs, 0.75rem);
      }

      .panel {
        position: absolute;
        z-index: var(--rv-z-overlay, 1000);
        right: 0;
        top: calc(100% + var(--rv-space-xs, 2px));
        display: grid;
        gap: var(--rv-space-sm, 6px);
        min-width: 14rem;
        padding: var(--rv-space-sm, 6px);
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface-raised, #fff);
        box-shadow: var(--rv-shadow-overlay, 0 8px 32px rgba(0, 0, 0, 0.25));
      }

      ul {
        display: grid;
        gap: var(--rv-space-xs, 2px);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li button {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: var(--rv-space-sm, 6px);
        width: 100%;
        text-align: left;
      }

      li button.selected {
        outline: 1px solid var(--rv-color-accent, #1f6feb);
      }

      .purpose {
        color: var(--rv-color-text-muted, #7a828d);
        font-size: var(--rv-font-size-xs, 0.75rem);
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--rv-space-sm, 6px);
      }

      p {
        margin: 0;
        color: var(--rv-color-text-muted, #7a828d);
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }
    `,
  ],
})
export class LorePromotePopoverComponent {
  readonly entryId = input.required<string>();
  readonly sourceLayerId = input.required<string>();
  readonly layers = input.required<readonly LoreLayer[]>();
  readonly loading = input(false);
  readonly promote = output<PromoteLoreEntryRequest>();

  protected readonly open = signal(false);
  protected readonly selectedLayerId = signal<string | undefined>(undefined);
  protected readonly targetLayers = computed(() =>
    this.layers().filter(
      (layer) =>
        layer.layerId !== this.sourceLayerId() &&
        !layer.archived &&
        layer.writePolicy === 'manual',
    ),
  );

  protected confirm(): void {
    const targetLayerId = this.selectedLayerId();
    if (targetLayerId === undefined) {
      return;
    }
    this.promote.emit({
      entryId: this.entryId(),
      sourceLayerId: this.sourceLayerId(),
      targetLayerId,
    });
    this.open.set(false);
  }
}
