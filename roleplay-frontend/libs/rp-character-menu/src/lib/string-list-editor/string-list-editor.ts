import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { TooltipDirective } from '@rusty-view/chat-components';

@Component({
  selector: 'rp-string-list-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  template: `
    <section class="string-list">
      <div class="list-actions">
        <span class="count">{{ items().length }} items</span>
        <button
          type="button"
          rvTooltip="Add a new editable item to this list"
          (click)="addItem()"
        >
          {{ addLabel() }}
        </button>
      </div>

      <ul>
        @for (item of items(); track $index; let index = $index) {
          <li>
            @if (editingIndex() === index) {
              <textarea
                rows="4"
                [attr.placeholder]="placeholder()"
                [value]="item"
                (input)="updateItem(index, inputValue($event))"
              ></textarea>
            } @else {
              <p>{{ preview(item) }}</p>
            }
            <div class="item-actions">
              <button
                type="button"
                [disabled]="index === 0"
                rvTooltip="Move this item earlier"
                (click)="moveItem(index, -1)"
              >
                Up
              </button>
              <button
                type="button"
                [disabled]="index === items().length - 1"
                rvTooltip="Move this item later"
                (click)="moveItem(index, 1)"
              >
                Down
              </button>
              <button
                type="button"
                rvTooltip="Edit this item inline"
                (click)="toggleEdit(index)"
              >
                {{ editingIndex() === index ? 'Done' : 'Edit' }}
              </button>
              <button
                type="button"
                rvTooltip="Remove this item from the list"
                (click)="deleteItem(index)"
              >
                Delete
              </button>
            </div>
          </li>
        } @empty {
          <li class="empty">{{ emptyMessage() }}</li>
        }
      </ul>
    </section>
  `,
  styles: [
    `
      .string-list {
        display: grid;
        gap: var(--rv-space-sm, 6px);
      }

      .list-actions,
      .item-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--rv-space-sm, 6px);
      }

      .list-actions {
        justify-content: space-between;
      }

      .count,
      .empty {
        color: var(--rv-color-text-muted, #7a828d);
        font-size: var(--rv-font-size-xs, 0.75rem);
      }

      ul {
        display: grid;
        gap: var(--rv-space-sm, 6px);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        display: grid;
        gap: var(--rv-space-sm, 6px);
        padding: var(--rv-space-sm, 6px);
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface-alt, #f6f7f9);
      }

      li.empty {
        color: var(--rv-color-text-muted, #7a828d);
        background: transparent;
      }

      p {
        min-height: 2.5rem;
        margin: 0;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }

      textarea {
        min-width: 0;
        width: 100%;
        resize: vertical;
        font: inherit;
      }

      button {
        flex: 0 0 auto;
      }
    `,
  ],
})
export class StringListEditorComponent {
  readonly items = input.required<readonly string[]>();
  readonly placeholder = input('');
  readonly addLabel = input('Add');
  readonly emptyMessage = input('No items yet.');
  readonly itemsChange = output<readonly string[]>();

  protected readonly editingIndex = signal<number | undefined>(undefined);
  protected addItem(): void {
    const next = [...this.items(), ''];
    this.itemsChange.emit(next);
    this.editingIndex.set(next.length - 1);
  }

  protected updateItem(index: number, value: string): void {
    const next = [...this.items()];
    next[index] = value;
    this.itemsChange.emit(next);
  }

  protected moveItem(index: number, delta: -1 | 1): void {
    const target = index + delta;
    const items = [...this.items()];
    if (target < 0 || target >= items.length) {
      return;
    }
    const [item] = items.splice(index, 1);
    if (item === undefined) {
      return;
    }
    items.splice(target, 0, item);
    this.itemsChange.emit(items);
    this.editingIndex.update((editing) =>
      editing === index ? target : editing,
    );
  }

  protected deleteItem(index: number): void {
    const next = this.items().filter((_, itemIndex) => itemIndex !== index);
    this.itemsChange.emit(next);
    this.editingIndex.update((editing) =>
      editing === index ? undefined : editing,
    );
  }

  protected toggleEdit(index: number): void {
    this.editingIndex.update((editing) =>
      editing === index ? undefined : index,
    );
  }

  protected preview(item: string): string {
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      return 'Empty item';
    }
    return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }
}
