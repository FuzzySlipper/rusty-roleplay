import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { TooltipDirective } from '@rusty-view/chat-components';

import {
  DEFAULT_ROLEPLAY_TEXT_STYLE,
  ROLEPLAY_TEXT_STYLE_PRESETS,
  presetById,
  type RoleplayTextStyleSettings,
} from './roleplay-transcript-presentation';

type ColorField =
  | 'dialogueColor'
  | 'narrationColor'
  | 'emphasisColor'
  | 'oocColor';

@Component({
  selector: 'app-roleplay-text-style-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  template: `
    <section class="text-style">
      <header>
        <h3>Text style</h3>
        <button
          type="button"
          rvTooltip="Restore the default roleplay text colors"
          rvTooltipPlacement="bottom"
          (click)="settingsChange.emit(DEFAULT_ROLEPLAY_TEXT_STYLE)"
        >
          Reset
        </button>
      </header>

      <label>
        Preset
        <select [value]="settings().presetId" (change)="selectPreset($event)">
          @for (preset of presets; track preset.id) {
            <option [value]="preset.id">{{ preset.label }}</option>
          }
        </select>
      </label>

      <div class="colors">
        <label>
          Dialogue
          <input
            type="color"
            [value]="settings().dialogueColor"
            (input)="updateColor('dialogueColor', inputValue($event))"
          />
        </label>
        <label>
          Narration
          <input
            type="color"
            [value]="settings().narrationColor"
            (input)="updateColor('narrationColor', inputValue($event))"
          />
        </label>
        <label>
          Emphasis
          <input
            type="color"
            [value]="settings().emphasisColor"
            (input)="updateColor('emphasisColor', inputValue($event))"
          />
        </label>
        <label>
          OOC
          <input
            type="color"
            [value]="settings().oocColor"
            (input)="updateColor('oocColor', inputValue($event))"
          />
        </label>
      </div>
    </section>
  `,
  styles: [
    `
      .text-style {
        display: grid;
        gap: 0.65rem;
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.45rem;
      }

      h3 {
        margin: 0;
      }

      label {
        display: grid;
        gap: 0.25rem;
        color: var(--rv-color-text-secondary, #48515d);
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      select,
      input {
        min-width: 0;
        width: 100%;
        font: inherit;
      }

      .colors {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.5rem;
      }
    `,
  ],
})
export class RoleplayTextStylePanelComponent {
  readonly settings = input<RoleplayTextStyleSettings>(
    DEFAULT_ROLEPLAY_TEXT_STYLE,
  );
  readonly settingsChange = output<RoleplayTextStyleSettings>();

  protected readonly DEFAULT_ROLEPLAY_TEXT_STYLE = DEFAULT_ROLEPLAY_TEXT_STYLE;
  protected readonly presets = ROLEPLAY_TEXT_STYLE_PRESETS;

  protected selectPreset(event: Event): void {
    this.settingsChange.emit(presetById(this.inputValue(event)));
  }

  protected updateColor(field: ColorField, value: string): void {
    this.settingsChange.emit({
      ...this.settings(),
      presetId: 'custom',
      [field]: value,
    });
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }
}
