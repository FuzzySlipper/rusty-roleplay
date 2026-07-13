import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { TooltipDirective } from '@rusty-view/chat-components';

import type {
  PlayerPersona,
  PlayerPersonaUpdateRequest,
  PlayerPersonaWriteRequest,
} from './player-persona.model';

type PersonaSort = 'name' | 'created';

interface PersonaDraft {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string;
  readonly description: string;
  readonly notes: string;
  readonly tagsText: string;
}

type PersonaDraftTextField = keyof PersonaDraft;

@Component({
  selector: 'app-player-persona-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  template: `
    <section class="personas">
      <header>
        <h3>Player personas</h3>
        <button
          type="button"
          rvTooltip="Create a player-side identity for roleplay messages"
          rvTooltipPlacement="bottom"
          (click)="newPersona()"
        >
          New
        </button>
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
        <p class="state">Loading personas...</p>
      } @else if (errorMessage()) {
        <p class="state error">{{ errorMessage() }}</p>
      }

      <ul>
        @for (persona of filteredPersonas(); track persona.id) {
          <li [class.active]="persona.id === activeId()">
            <button
              type="button"
              class="summary"
              rvTooltip="Use this player persona in the current session"
              rvTooltipPlacement="right"
              (click)="personaActivate.emit(persona.id)"
            >
              @if (persona.avatarUrl) {
                <img [src]="persona.avatarUrl" alt="" />
              } @else {
                <span class="avatar" aria-hidden="true">{{
                  initials(persona.name)
                }}</span>
              }
              <span class="copy">
                <span class="name">{{ persona.name }}</span>
                <span class="description">{{
                  persona.description || persona.notes || 'No notes'
                }}</span>
              </span>
            </button>
            @if (persona.tags.length > 0) {
              <div class="tags">
                @for (tag of persona.tags; track tag) {
                  <span>{{ tag }}</span>
                }
              </div>
            }
            <div class="actions">
              <button
                type="button"
                rvTooltip="Edit this player persona"
                rvTooltipPlacement="top"
                (click)="editPersona(persona)"
              >
                Edit
              </button>
              <button
                type="button"
                rvTooltip="Archive this persona without deleting old messages"
                rvTooltipPlacement="top"
                (click)="personaArchive.emit(persona.id)"
              >
                Archive
              </button>
            </div>
          </li>
        } @empty {
          <li class="empty">No player personas.</li>
        }
      </ul>

      @if (draft(); as currentDraft) {
        <form class="editor" (submit)="saveDraft($event)">
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
              alt="Persona avatar preview"
            />
          }
          <label>
            Description
            <textarea
              name="description"
              rows="4"
              [value]="currentDraft.description"
              (input)="updateDraft('description', inputValue($event))"
            ></textarea>
          </label>
          <label>
            Notes
            <textarea
              name="notes"
              rows="4"
              [value]="currentDraft.notes"
              (input)="updateDraft('notes', inputValue($event))"
            ></textarea>
          </label>
          <label>
            Tags
            <input
              name="tags"
              type="text"
              placeholder="mage, reluctant hero"
              [value]="currentDraft.tagsText"
              (input)="updateDraft('tagsText', inputValue($event))"
            />
          </label>
          <div class="actions">
            <button
              type="button"
              rvTooltip="Close the persona editor without saving"
              rvTooltipPlacement="top"
              (click)="cancelEdit()"
            >
              Cancel
            </button>
            <button
              type="submit"
              rvTooltip="Save this player persona"
              rvTooltipPlacement="top"
              [disabled]="currentDraft.name.trim() === ''"
            >
              Save
            </button>
          </div>
        </form>
      }
    </section>
  `,
  styles: [
    `
      .personas {
        display: grid;
        gap: 0.65rem;
      }

      header,
      .toolbar,
      .actions {
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

      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }

      li,
      .editor {
        display: grid;
        gap: 0.45rem;
        padding: 0.55rem;
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface, #fff);
      }

      li.active {
        border-color: var(--rv-color-accent, #3b82f6);
        box-shadow: 0 0 0 1px var(--rv-color-accent, #3b82f6);
      }

      .summary {
        display: grid;
        grid-template-columns: 2.25rem minmax(0, 1fr);
        gap: 0.5rem;
        align-items: center;
        padding: 0;
        border: 0;
        background: transparent;
        text-align: left;
        cursor: pointer;
      }

      img,
      .avatar {
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 999px;
        object-fit: cover;
      }

      .avatar {
        display: inline-grid;
        place-items: center;
        background: var(--rv-color-surface-alt, #f6f7f9);
        font-weight: 700;
      }

      .copy,
      label {
        min-width: 0;
        display: grid;
        gap: 0.2rem;
      }

      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
      }

      .description,
      .state,
      label {
        color: var(--rv-color-text-secondary, #48515d);
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .description {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .error {
        color: var(--rv-color-danger, #cf222e);
      }

      .actions {
        justify-content: flex-end;
        flex-wrap: wrap;
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
      }

      .tags span {
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: 999px;
        padding: 0.1rem 0.4rem;
        color: var(--rv-color-text-secondary, #48515d);
        font-size: var(--rv-font-size-xs, 0.75rem);
      }

      .empty {
        color: var(--rv-color-text-muted, #7a828d);
        padding: 1rem;
        text-align: center;
      }

      input,
      select,
      textarea {
        min-width: 0;
        width: 100%;
        font: inherit;
      }

      textarea {
        resize: vertical;
      }

      .avatar-preview {
        width: 4.5rem;
        height: 4.5rem;
      }
    `,
  ],
})
export class PlayerPersonaManagerComponent {
  readonly personas = input.required<readonly PlayerPersona[]>();
  readonly activeId = input<string | undefined>(undefined);
  readonly loading = input<boolean>(false);
  readonly errorMessage = input<string | undefined>(undefined);

  readonly personaActivate = output<string>();
  readonly personaCreate = output<PlayerPersonaWriteRequest>();
  readonly personaUpdate = output<PlayerPersonaUpdateRequest>();
  readonly personaArchive = output<string>();

  protected readonly query = signal('');
  protected readonly sort = signal<PersonaSort>('name');
  protected readonly draft = signal<PersonaDraft | null>(null);

  protected readonly filteredPersonas = computed(() => {
    const query = this.query().trim().toLowerCase();
    return [...this.personas()]
      .filter((persona) => {
        if (query === '') {
          return true;
        }
        return [persona.name, persona.description, persona.notes, ...persona.tags]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) => {
        if (this.sort() === 'created') {
          return (
            Date.parse(right.createdAt ?? right.updatedAt ?? '') -
            Date.parse(left.createdAt ?? left.updatedAt ?? '')
          );
        }
        return left.name.localeCompare(right.name);
      });
  });

  protected setSort(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value as PersonaSort);
  }

  protected newPersona(): void {
    this.draft.set({
      id: '',
      name: '',
      avatarUrl: '',
      description: '',
      notes: '',
      tagsText: '',
    });
  }

  protected editPersona(persona: PlayerPersona): void {
    this.draft.set({
      id: persona.id,
      name: persona.name,
      avatarUrl: persona.avatarUrl ?? '',
      description: persona.description,
      notes: persona.notes,
      tagsText: persona.tags.join(', '),
    });
  }

  protected cancelEdit(): void {
    this.draft.set(null);
  }

  protected updateDraft(field: PersonaDraftTextField, value: string): void {
    this.draft.update((draft) =>
      draft === null ? draft : { ...draft, [field]: value },
    );
  }

  protected setAvatarFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file === undefined) {
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        this.updateDraft('avatarUrl', reader.result);
      }
    });
    reader.readAsDataURL(file);
  }

  protected saveDraft(event: Event): void {
    event.preventDefault();
    const draft = this.draft();
    if (draft === null || draft.name.trim() === '') {
      return;
    }
    const request: PlayerPersonaWriteRequest = {
      name: draft.name.trim(),
      avatarUrl: draft.avatarUrl.trim() || undefined,
      description: draft.description.trim(),
      notes: draft.notes.trim(),
      tags: draft.tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    };
    if (draft.id) {
      this.personaUpdate.emit({ id: draft.id, patch: request });
    } else {
      this.personaCreate.emit(request);
    }
    this.cancelEdit();
  }

  protected initials(value: string): string {
    const initials = value
      .split(/\s+/)
      .filter((part) => part.length > 0)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
    return initials || '?';
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
