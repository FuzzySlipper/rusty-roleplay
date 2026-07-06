import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { TooltipDirective } from '@rusty-view/chat-components';

import { CreateLayerDialogComponent } from '../create-layer-dialog/create-layer-dialog';
import type {
  ChatLoreLayer,
  CreateLoreLayerRequest,
  ReorderLoreLayerRequest,
  ToggleLoreLayerRequest,
} from '../lore-layer.model';

@Component({
  selector: 'rp-lore-layer-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CreateLayerDialogComponent, TooltipDirective],
  template: `
    <section class="layers">
      <header>
        <div>
          <h3>Lore Layers</h3>
          @if (activeCount() > 0) {
            <span class="count">{{ activeCount() }} active</span>
          }
        </div>
        <button
          type="button"
          rvTooltip="Create a lore layer for world, story, character, or faction facts"
          rvTooltipPlacement="bottom"
          (click)="creating.set(true)"
        >
          New
        </button>
      </header>

      <rp-create-layer-dialog
        [open]="creating()"
        (layerCreate)="layerCreate.emit($event); creating.set(false)"
        (dialogCancel)="creating.set(false)"
      />

      @if (loading()) {
        <p class="state">Loading layers...</p>
      } @else if (errorMessage()) {
        <p class="state error">{{ errorMessage() }}</p>
      } @else {
        <ul>
          @for (
            layer of orderedLayers();
            track layer.layerId;
            let first = $first;
            let last = $last
          ) {
            <li [class.disabled]="!layer.enabled">
              <div class="main">
                <span class="handle" aria-hidden="true">::</span>
                <label>
                  <input
                    type="checkbox"
                    [checked]="layer.enabled"
                    (change)="toggleLayer(layer, $event)"
                  />
                  <span class="name">{{ layer.name }}</span>
                </label>
                <span class="entries">{{ layer.entryCount }}</span>
              </div>
              <p class="description">
                {{ layer.description || layer.purpose }}
              </p>
              <div class="meta">
                <span class="badge">{{ layer.writePolicy }}</span>
                <span>{{ layer.purpose }}</span>
                <button
                  type="button"
                  rvTooltip="Move this lore layer earlier in retrieval priority"
                  rvTooltipPlacement="top"
                  [disabled]="first"
                  (click)="
                    layerReorder.emit({
                      layerId: layer.layerId,
                      direction: 'up',
                    })
                  "
                >
                  Up
                </button>
                <button
                  type="button"
                  rvTooltip="Move this lore layer later in retrieval priority"
                  rvTooltipPlacement="top"
                  [disabled]="last"
                  (click)="
                    layerReorder.emit({
                      layerId: layer.layerId,
                      direction: 'down',
                    })
                  "
                >
                  Down
                </button>
              </div>
            </li>
          } @empty {
            <li class="empty">No lore layers.</li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      .layers {
        display: grid;
        gap: 0.65rem;
      }

      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
      }

      h3,
      p {
        margin: 0;
      }

      .count,
      .state,
      .description,
      .meta {
        color: var(--rv-color-text-secondary, #48515d);
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .error {
        color: var(--rv-color-danger, #cf222e);
      }

      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }

      li {
        display: grid;
        gap: 0.25rem;
        padding: 0.55rem;
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface, #fff);
      }

      li.disabled {
        opacity: 0.62;
      }

      .main {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.4rem;
      }

      label {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }

      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
      }

      .handle {
        color: var(--rv-color-text-muted, #7a828d);
        font-family: var(--rv-font-mono, monospace);
      }

      .entries {
        min-width: 1.5rem;
        text-align: center;
        border-radius: 999px;
        background: var(--rv-color-surface-alt, #f6f7f9);
        font-size: var(--rv-font-size-xs, 0.75rem);
      }

      .meta {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
      }

      .badge {
        padding: 0.05rem 0.3rem;
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
      }

      .empty {
        color: var(--rv-color-text-muted, #7a828d);
      }
    `,
  ],
})
export class LoreLayerPanelComponent {
  readonly layers = input.required<readonly ChatLoreLayer[]>();
  readonly loading = input<boolean>(false);
  readonly errorMessage = input<string | undefined>(undefined);

  readonly layerToggle = output<ToggleLoreLayerRequest>();
  readonly layerReorder = output<ReorderLoreLayerRequest>();
  readonly layerCreate = output<CreateLoreLayerRequest>();

  protected readonly creating = signal(false);
  protected readonly orderedLayers = computed(() =>
    [...this.layers()].sort((left, right) => left.priority - right.priority),
  );
  protected readonly activeCount = computed(
    () => this.layers().filter((layer) => layer.enabled).length,
  );

  protected toggleLayer(layer: ChatLoreLayer, event: Event): void {
    this.layerToggle.emit({
      layerId: layer.layerId,
      enabled: (event.target as HTMLInputElement).checked,
    });
  }
}
