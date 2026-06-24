import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/** A character available in the current campaign/scene. */
export interface RpCharacter {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
}

/**
 * Character selector for the current scene. Presentational: the container owns
 * the character list and the active selection. Emits the id to activate.
 */
@Component({
  selector: 'rp-character-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rp-character-menu">
      <h3>Characters</h3>
      <ul>
        @for (character of characters(); track character.id) {
          <li>
            <button
              type="button"
              [class.active]="character.id === activeId()"
              (click)="activate.emit(character.id)"
            >
              <span class="name">{{ character.name }}</span>
              <span class="tagline">{{ character.tagline }}</span>
            </button>
          </li>
        }
      </ul>
    </section>
  `,
  styles: [
    `
      .rp-character-menu ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      button {
        display: grid;
        width: 100%;
        text-align: left;
        padding: 0.4rem 0.6rem;
        cursor: pointer;
      }
      button.active {
        outline: 2px solid currentColor;
      }
      .tagline {
        font-size: 0.8rem;
        opacity: 0.75;
      }
    `,
  ],
})
export class RpCharacterMenuComponent {
  readonly characters = input.required<readonly RpCharacter[]>();
  readonly activeId = input<string | undefined>(undefined);
  readonly activate = output<string>();
}
