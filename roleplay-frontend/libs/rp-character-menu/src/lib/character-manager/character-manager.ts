import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import type {
  CharacterUpdateRequest,
  CharacterWriteRequest,
  RpCharacter,
} from '../character.model';

type CharacterEditorTab = 'basic' | 'scene' | 'examples';
type CharacterSort = 'name' | 'created';

interface CharacterDraft {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly personality: string;
  readonly scenario: string;
  readonly firstMessage: string;
  readonly alternateGreetingsText: string;
  readonly exampleMessagesText: string;
  readonly tagsText: string;
  readonly avatarUrl: string;
}

@Component({
  selector: 'rp-character-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="characters">
      <header>
        <h3>Characters</h3>
        <button type="button" (click)="newCharacter()">New</button>
      </header>

      <div class="toolbar">
        <input
          type="search"
          placeholder="Search"
          [value]="query()"
          (input)="query.set(inputValue($event))"
        />
        <select [value]="sort()" (change)="setSort($event)">
          <option value="name">Name</option>
          <option value="created">Newest</option>
        </select>
      </div>

      @if (loading()) {
        <p class="state">Loading characters...</p>
      } @else if (errorMessage()) {
        <p class="state error">{{ errorMessage() }}</p>
      }

      <ul>
        @for (character of filteredCharacters(); track character.id) {
          <li [class.active]="character.id === activeId()">
            <button
              type="button"
              class="summary"
              (click)="characterActivate.emit(character.id)"
            >
              @if (character.avatarUrl) {
                <img [src]="character.avatarUrl" alt="" />
              } @else {
                <span class="avatar" aria-hidden="true">{{
                  initials(character.name)
                }}</span>
              }
              <span class="copy">
                <span class="name">{{ character.name }}</span>
                <span class="description">{{
                  character.description || character.personality || 'No notes'
                }}</span>
              </span>
            </button>
            @if (character.tags.length > 0) {
              <div class="tags">
                @for (tag of character.tags; track tag) {
                  <span>{{ tag }}</span>
                }
              </div>
            }
            <div class="actions">
              <button type="button" (click)="editCharacter(character)">
                Edit
              </button>
              <button
                type="button"
                (click)="characterArchive.emit(character.id)"
              >
                Archive
              </button>
            </div>
          </li>
        } @empty {
          <li class="empty">No characters.</li>
        }
      </ul>

      @if (draft(); as currentDraft) {
        <form class="editor" (submit)="saveDraft($event)">
          <div class="tabs">
            <button
              type="button"
              [class.active]="tab() === 'basic'"
              (click)="tab.set('basic')"
            >
              Basic
            </button>
            <button
              type="button"
              [class.active]="tab() === 'scene'"
              (click)="tab.set('scene')"
            >
              Scene
            </button>
            <button
              type="button"
              [class.active]="tab() === 'examples'"
              (click)="tab.set('examples')"
            >
              Examples
            </button>
          </div>

          @switch (tab()) {
            @case ('basic') {
              <label>
                Name
                <input
                  name="name"
                  type="text"
                  autocomplete="off"
                  [value]="currentDraft.name"
                  (input)="updateDraft('name', inputValue($event))"
                />
              </label>
              <label>
                Avatar URL
                <input
                  name="avatarUrl"
                  type="url"
                  [value]="currentDraft.avatarUrl"
                  (input)="updateDraft('avatarUrl', inputValue($event))"
                />
              </label>
              <label>
                Description
                <textarea
                  rows="3"
                  [value]="currentDraft.description"
                  (input)="updateDraft('description', inputValue($event))"
                ></textarea>
              </label>
              <label>
                Personality
                <textarea
                  rows="4"
                  [value]="currentDraft.personality"
                  (input)="updateDraft('personality', inputValue($event))"
                ></textarea>
              </label>
            }
            @case ('scene') {
              <label>
                Scenario
                <textarea
                  rows="5"
                  [value]="currentDraft.scenario"
                  (input)="updateDraft('scenario', inputValue($event))"
                ></textarea>
              </label>
              <label>
                First message
                <textarea
                  rows="4"
                  [value]="currentDraft.firstMessage"
                  (input)="updateDraft('firstMessage', inputValue($event))"
                ></textarea>
              </label>
              <label>
                Alternate greetings
                <textarea
                  rows="4"
                  [value]="currentDraft.alternateGreetingsText"
                  (input)="
                    updateDraft('alternateGreetingsText', inputValue($event))
                  "
                ></textarea>
              </label>
            }
            @case ('examples') {
              <label>
                Example messages
                <textarea
                  rows="5"
                  [value]="currentDraft.exampleMessagesText"
                  (input)="
                    updateDraft('exampleMessagesText', inputValue($event))
                  "
                ></textarea>
              </label>
              <label>
                Tags
                <input
                  name="tags"
                  type="text"
                  [value]="currentDraft.tagsText"
                  (input)="updateDraft('tagsText', inputValue($event))"
                />
              </label>
            }
          }

          <div class="editor-actions">
            <button type="button" (click)="cancelEdit()">Cancel</button>
            <button type="submit" [disabled]="currentDraft.name.trim() === ''">
              Save
            </button>
          </div>
        </form>
      }
    </section>
  `,
  styles: [
    `
      .characters {
        display: grid;
        gap: 0.65rem;
      }

      header,
      .toolbar,
      .actions,
      .editor-actions,
      .tabs {
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }

      header {
        justify-content: space-between;
      }

      h3,
      p {
        margin: 0;
      }

      .toolbar {
        align-items: stretch;
      }

      .toolbar input {
        min-width: 0;
        flex: 1;
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
        gap: 0.35rem;
        padding: 0.55rem;
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface, #fff);
      }

      li.active {
        outline: 2px solid currentColor;
      }

      .summary {
        display: grid;
        grid-template-columns: 2rem minmax(0, 1fr);
        align-items: center;
        gap: 0.55rem;
        padding: 0;
        border: 0;
        background: transparent;
        text-align: left;
        cursor: pointer;
      }

      img,
      .avatar {
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
      }

      img {
        object-fit: cover;
      }

      .avatar {
        display: grid;
        place-items: center;
        background: var(--rv-color-surface-alt, #f6f7f9);
        font-size: var(--rv-font-size-xs, 0.75rem);
        font-weight: 700;
      }

      .copy {
        min-width: 0;
        display: grid;
        gap: 0.1rem;
      }

      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
      }

      .description,
      .state,
      .tags {
        color: var(--rv-color-text-secondary, #48515d);
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .error {
        color: var(--rv-color-danger, #cf222e);
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
      }

      .tags span {
        padding: 0.05rem 0.3rem;
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
      }

      .actions {
        justify-content: flex-end;
      }

      .empty {
        color: var(--rv-color-text-muted, #7a828d);
      }

      .editor {
        display: grid;
        gap: 0.55rem;
        padding: 0.65rem;
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface, #fff);
      }

      .tabs button.active {
        outline: 2px solid currentColor;
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

      .editor-actions {
        justify-content: flex-end;
      }
    `,
  ],
})
export class RpCharacterManagerComponent {
  readonly characters = input.required<readonly RpCharacter[]>();
  readonly activeId = input<string | undefined>(undefined);
  readonly loading = input<boolean>(false);
  readonly errorMessage = input<string | undefined>(undefined);

  readonly characterActivate = output<string>();
  readonly characterCreate = output<CharacterWriteRequest>();
  readonly characterUpdate = output<CharacterUpdateRequest>();
  readonly characterArchive = output<string>();

  protected readonly query = signal('');
  protected readonly sort = signal<CharacterSort>('name');
  protected readonly tab = signal<CharacterEditorTab>('basic');
  protected readonly editingId = signal<string | undefined>(undefined);
  protected readonly draft = signal<CharacterDraft | undefined>(undefined);
  protected readonly filteredCharacters = computed(() => {
    const query = this.query().trim().toLowerCase();
    const filtered = this.characters().filter((character) => {
      if (query === '') {
        return true;
      }
      return [
        character.name,
        character.description,
        character.personality,
        ...character.tags,
      ].some((value) => value.toLowerCase().includes(query));
    });
    return [...filtered].sort((left, right) => {
      if (this.sort() === 'created') {
        return (
          Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '')
        );
      }
      return left.name.localeCompare(right.name);
    });
  });

  protected newCharacter(): void {
    this.editingId.set(undefined);
    this.tab.set('basic');
    this.draft.set(emptyDraft());
  }

  protected editCharacter(character: RpCharacter): void {
    this.editingId.set(character.id);
    this.tab.set('basic');
    this.draft.set({
      id: character.id,
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      firstMessage: character.firstMessage,
      alternateGreetingsText: character.alternateGreetings.join('\n'),
      exampleMessagesText: character.exampleMessages.join('\n'),
      tagsText: character.tags.join(', '),
      avatarUrl: character.avatarUrl ?? '',
    });
  }

  protected cancelEdit(): void {
    this.editingId.set(undefined);
    this.draft.set(undefined);
  }

  protected saveDraft(event: Event): void {
    event.preventDefault();
    const draft = this.draft();
    if (draft === undefined || draft.name.trim() === '') {
      return;
    }
    const request = draftToRequest(draft);
    const editingId = this.editingId();
    if (editingId === undefined) {
      this.characterCreate.emit(request);
    } else {
      this.characterUpdate.emit({ id: editingId, patch: request });
    }
    this.cancelEdit();
  }

  protected updateDraft(key: keyof CharacterDraft, value: string): void {
    this.draft.update((draft) =>
      draft === undefined ? draft : { ...draft, [key]: value },
    );
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected setSort(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value as CharacterSort);
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}

function emptyDraft(): CharacterDraft {
  return {
    id: '',
    name: '',
    description: '',
    personality: '',
    scenario: '',
    firstMessage: '',
    alternateGreetingsText: '',
    exampleMessagesText: '',
    tagsText: '',
    avatarUrl: '',
  };
}

function draftToRequest(draft: CharacterDraft): CharacterWriteRequest {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    personality: draft.personality.trim(),
    scenario: draft.scenario.trim(),
    firstMessage: draft.firstMessage.trim(),
    alternateGreetings: lines(draft.alternateGreetingsText),
    exampleMessages: lines(draft.exampleMessagesText),
    tags: draft.tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    ...(draft.avatarUrl.trim() === ''
      ? {}
      : { avatarUrl: draft.avatarUrl.trim() }),
  };
}

function lines(value: string): readonly string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
