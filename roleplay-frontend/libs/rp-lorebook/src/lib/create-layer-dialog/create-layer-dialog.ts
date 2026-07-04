import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';

import type {
  CreateLoreLayerRequest,
  LoreLayerPurpose,
  LoreLayerWritePolicy,
} from '../lore-layer.model';

const PURPOSES: readonly LoreLayerPurpose[] = [
  'world',
  'story',
  'characters',
  'factions',
  'mixed',
];

const WRITE_POLICIES: readonly LoreLayerWritePolicy[] = [
  'manual',
  'auto_capture',
  'readonly',
];

@Component({
  selector: 'rp-create-layer-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <form class="dialog" (submit)="submit($event)">
        <label>
          Name
          <input
            name="name"
            type="text"
            autocomplete="off"
            [value]="name()"
            (input)="name.set(inputValue($event))"
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            rows="3"
            [value]="description()"
            (input)="description.set(inputValue($event))"
          ></textarea>
        </label>
        <div class="row">
          <label>
            Purpose
            <select [value]="purpose()" (change)="setPurpose($event)">
              @for (option of purposes; track option) {
                <option [value]="option">{{ option }}</option>
              }
            </select>
          </label>
          <label>
            Writes
            <select [value]="writePolicy()" (change)="setWritePolicy($event)">
              @for (option of writePolicies; track option) {
                <option [value]="option">{{ option }}</option>
              }
            </select>
          </label>
        </div>
        <div class="actions">
          <button type="button" (click)="dialogCancel.emit()">Cancel</button>
          <button type="submit" [disabled]="name().trim().length === 0">
            Create
          </button>
        </div>
      </form>
    }
  `,
  styles: [
    `
      .dialog {
        display: grid;
        gap: 0.5rem;
        padding: 0.65rem;
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface, #fff);
      }

      label {
        display: grid;
        gap: 0.25rem;
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      input,
      textarea,
      select {
        min-width: 0;
        width: 100%;
        font: inherit;
      }

      .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 0.5rem;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.4rem;
      }
    `,
  ],
})
export class CreateLayerDialogComponent {
  readonly open = input<boolean>(false);
  readonly layerCreate = output<CreateLoreLayerRequest>();
  readonly dialogCancel = output<void>();

  protected readonly purposes = PURPOSES;
  protected readonly writePolicies = WRITE_POLICIES;
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly purpose = signal<LoreLayerPurpose>('world');
  protected readonly writePolicy = signal<LoreLayerWritePolicy>('manual');

  protected submit(event: Event): void {
    event.preventDefault();
    const name = this.name().trim();
    if (!name) {
      return;
    }
    this.layerCreate.emit({
      name,
      description: this.description().trim(),
      purpose: this.purpose(),
      writePolicy: this.writePolicy(),
    });
    this.name.set('');
    this.description.set('');
    this.purpose.set('world');
    this.writePolicy.set('manual');
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected setPurpose(event: Event): void {
    this.purpose.set(
      (event.target as HTMLSelectElement).value as LoreLayerPurpose,
    );
  }

  protected setWritePolicy(event: Event): void {
    this.writePolicy.set(
      (event.target as HTMLSelectElement).value as LoreLayerWritePolicy,
    );
  }
}
