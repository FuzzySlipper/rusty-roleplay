import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { TooltipDirective } from '@rusty-view/chat-components';

import { StringListEditorComponent } from '../string-list-editor/string-list-editor';
import {
  characterToTavernCardJson,
  importCharacterCardFile,
} from '../character-card-codec';
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
  readonly alternateGreetings: readonly string[];
  readonly exampleMessages: readonly string[];
  readonly tagsText: string;
  readonly avatarUrl: string;
}

type CharacterDraftTextField = Exclude<
  keyof CharacterDraft,
  'alternateGreetings' | 'exampleMessages'
>;

@Component({
  selector: 'rp-character-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StringListEditorComponent, TooltipDirective],
  template: `
    <section class="characters">
      <header>
        <h3>Characters</h3>
        <button
          type="button"
          rvTooltip="Create a character profile for roleplay sessions"
          rvTooltipPlacement="bottom"
          (click)="newCharacter()"
        >
          New
        </button>
        <label
          class="import-button"
          rvTooltip="Import a SillyTavern JSON or PNG character card"
          rvTooltipPlacement="bottom"
        >
          Import
          <input
            type="file"
            accept="application/json,.json,image/png,.png"
            (change)="importCharacter($event)"
          />
        </label>
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
      @if (importError()) {
        <p class="state error">{{ importError() }}</p>
      }

      <ul>
        @for (character of filteredCharacters(); track character.id) {
          <li [class.active]="character.id === activeId()">
            <button
              type="button"
              class="summary"
              rvTooltip="Activate this character for the current scene"
              rvTooltipPlacement="right"
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
              <button
                type="button"
                rvTooltip="Edit this character profile"
                rvTooltipPlacement="top"
                (click)="editCharacter(character)"
              >
                Edit
              </button>
              <button
                type="button"
                rvTooltip="Export this character as a Tavern Card JSON file"
                rvTooltipPlacement="top"
                (click)="exportCharacter(character)"
              >
                Export
              </button>
              <button
                type="button"
                rvTooltip="Archive this character without deleting its record"
                rvTooltipPlacement="top"
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
                Avatar image
                <input
                  name="avatarFile"
                  type="file"
                  accept="image/*"
                  (change)="setAvatarFile($event)"
                />
              </label>
              @if (currentDraft.avatarUrl) {
                <img
                  class="avatar-preview"
                  [src]="currentDraft.avatarUrl"
                  alt="Character avatar preview"
                />
              }
              <label>
                Description
                <textarea
                  rows="3"
                  [value]="currentDraft.description"
                  (input)="updateDraft('description', inputValue($event))"
                ></textarea>
                <span
                  class="hint"
                  [class.over-limit]="
                    isOverLimit(currentDraft.description, limits.description)
                  "
                >
                  Description:
                  {{ currentDraft.description.length }}/{{ limits.description }}
                  chars
                </span>
              </label>
              <label>
                Personality
                <textarea
                  rows="4"
                  [value]="currentDraft.personality"
                  (input)="updateDraft('personality', inputValue($event))"
                ></textarea>
                <span
                  class="hint"
                  [class.over-limit]="
                    isOverLimit(currentDraft.personality, limits.personality)
                  "
                >
                  Personality:
                  {{ currentDraft.personality.length }}/{{ limits.personality }}
                  chars
                </span>
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
                <span
                  class="hint"
                  [class.over-limit]="
                    isOverLimit(currentDraft.scenario, limits.scenario)
                  "
                >
                  Scenario: {{ currentDraft.scenario.length }}/{{
                    limits.scenario
                  }}
                  chars
                </span>
              </label>
              <label>
                First message
                <textarea
                  rows="4"
                  [value]="currentDraft.firstMessage"
                  (input)="updateDraft('firstMessage', inputValue($event))"
                ></textarea>
                <span
                  class="hint"
                  [class.over-limit]="
                    isOverLimit(currentDraft.firstMessage, limits.firstMessage)
                  "
                >
                  First message: {{ currentDraft.firstMessage.length }}/{{
                    limits.firstMessage
                  }}
                  chars
                </span>
              </label>
              @if (currentDraft.firstMessage.trim()) {
                <article
                  class="message-preview"
                  aria-label="First message preview"
                >
                  <span class="preview-author">{{
                    currentDraft.name || 'Character'
                  }}</span>
                  <p>{{ currentDraft.firstMessage }}</p>
                </article>
              }
              <section class="editor-section">
                <h4>Alternate greetings</h4>
                <rp-string-list-editor
                  [items]="currentDraft.alternateGreetings"
                  placeholder="Write an alternate opening message"
                  addLabel="Add greeting"
                  emptyMessage="No alternate greetings yet."
                  (itemsChange)="updateList('alternateGreetings', $event)"
                />
              </section>
            }
            @case ('examples') {
              <section class="editor-section">
                <h4>Example messages</h4>
                <rp-string-list-editor
                  [items]="currentDraft.exampleMessages"
                  placeholder="Write an example dialogue line"
                  addLabel="Add example"
                  emptyMessage="No example messages yet."
                  (itemsChange)="updateList('exampleMessages', $event)"
                />
              </section>
              <label>
                Tags
                <input
                  name="tags"
                  type="text"
                  [value]="currentDraft.tagsText"
                  (input)="updateDraft('tagsText', inputValue($event))"
                />
                <span
                  class="hint"
                  [class.over-limit]="
                    isOverLimit(currentDraft.tagsText, limits.tags)
                  "
                >
                  Tags: {{ currentDraft.tagsText.length }}/{{ limits.tags }}
                  chars
                </span>
              </label>
            }
          }

          <div class="editor-actions">
            <button
              type="button"
              rvTooltip="Close the character editor without saving"
              rvTooltipPlacement="top"
              (click)="cancelEdit()"
            >
              Cancel
            </button>
            <button
              type="submit"
              rvTooltip="Save this character profile"
              rvTooltipPlacement="top"
              [disabled]="currentDraft.name.trim() === ''"
            >
              {{ saveConfirmed() ? 'Saved' : 'Save' }}
            </button>
          </div>
        </form>
      }
      @if (saveConfirmed()) {
        <p class="save-confirmation" role="status">Character saved.</p>
      }
    </section>
  `,
  styleUrl: './character-manager.css',
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
  protected readonly saveConfirmed = signal(false);
  protected readonly importError = signal<string | undefined>(undefined);
  protected readonly limits = {
    description: 500,
    personality: 1200,
    scenario: 1200,
    firstMessage: 800,
    tags: 200,
  } as const;
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
    this.importError.set(undefined);
    this.editingId.set(undefined);
    this.tab.set('basic');
    this.draft.set(emptyDraft());
  }

  protected editCharacter(character: RpCharacter): void {
    this.importError.set(undefined);
    this.editingId.set(character.id);
    this.tab.set('basic');
    this.draft.set({
      id: character.id,
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      firstMessage: character.firstMessage,
      alternateGreetings: [...character.alternateGreetings],
      exampleMessages: [...character.exampleMessages],
      tagsText: character.tags.join(', '),
      avatarUrl: character.avatarUrl ?? '',
    });
  }

  protected cancelEdit(): void {
    this.editingId.set(undefined);
    this.draft.set(undefined);
  }

  protected async importCharacter(event: Event): Promise<void> {
    this.importError.set(undefined);
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) {
      return;
    }

    try {
      this.loadImportedCharacter(await importCharacterCardFile(file));
    } catch (error: unknown) {
      this.importError.set(readErrorMessage(error));
    }
  }

  protected exportCharacter(character: RpCharacter): void {
    const blob = new Blob([characterToTavernCardJson(character)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeFileName(character.name)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected setAvatarFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) {
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      this.updateDraft('avatarUrl', String(reader.result));
    });
    reader.addEventListener('error', () => {
      this.importError.set('Could not read avatar image.');
    });
    reader.readAsDataURL(file);
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
    this.showSaveConfirmation();
    this.cancelEdit();
  }

  protected updateDraft(key: CharacterDraftTextField, value: string): void {
    this.draft.update((draft) =>
      draft === undefined ? draft : { ...draft, [key]: value },
    );
  }

  protected updateList(
    key: 'alternateGreetings' | 'exampleMessages',
    value: readonly string[],
  ): void {
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

  protected isOverLimit(value: string, limit: number): boolean {
    return value.length > limit;
  }

  private showSaveConfirmation(): void {
    this.saveConfirmed.set(true);
    setTimeout(() => this.saveConfirmed.set(false), 1800);
  }

  private loadImportedCharacter(request: CharacterWriteRequest): void {
    this.editingId.set(undefined);
    this.tab.set('basic');
    this.draft.set({
      id: request.id ?? '',
      name: request.name,
      description: request.description,
      personality: request.personality,
      scenario: request.scenario,
      firstMessage: request.firstMessage,
      alternateGreetings: [...request.alternateGreetings],
      exampleMessages: [...request.exampleMessages],
      tagsText: request.tags.join(', '),
      avatarUrl: request.avatarUrl ?? '',
    });
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
    alternateGreetings: [],
    exampleMessages: [],
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
    alternateGreetings: cleanItems(draft.alternateGreetings),
    exampleMessages: cleanItems(draft.exampleMessages),
    tags: draft.tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    ...(draft.avatarUrl.trim() === ''
      ? {}
      : { avatarUrl: draft.avatarUrl.trim() }),
  };
}

function cleanItems(value: readonly string[]): readonly string[] {
  return value.map((item) => item.trim()).filter(Boolean);
}

function safeFileName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'character'
  );
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
