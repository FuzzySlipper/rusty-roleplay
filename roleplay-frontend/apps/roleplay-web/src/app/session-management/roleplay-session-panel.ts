import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { TooltipDirective } from '@rusty-view/chat-components';
import type { RpCharacter } from '@rusty-roleplay/rp-character-menu';
import type { LoreLayer } from '@rusty-roleplay/rp-lorebook';

import type {
  CreateRoleplaySessionRequest,
  RoleplaySessionSummary,
  UpdateRoleplaySessionRequest,
} from './roleplay-session.model';

type SessionFilter = 'active' | 'archived' | 'all';
type CreateStep = 'character' | 'layers' | 'name' | 'confirm';

@Component({
  selector: 'app-roleplay-session-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  template: `
    <section class="sessions">
      <header>
        <h3>Sessions</h3>
        <button
          type="button"
          rvTooltip="Create a roleplay session with character and lore context"
          rvTooltipPlacement="bottom"
          (click)="startCreate()"
        >
          New
        </button>
      </header>

      <div class="toolbar">
        <select [value]="filter()" (change)="setFilter($event)">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
      </div>

      @if (loading()) {
        <p class="state">Loading sessions...</p>
      } @else if (errorMessage()) {
        <p class="state error">{{ errorMessage() }}</p>
      }

      <ul>
        @for (session of visibleSessions(); track session.sessionId) {
          <li
            [class.active]="session.sessionId === activeSessionId()"
            [class.created]="session.sessionId === highlightedSessionId()"
          >
            <div class="card-top">
              <span class="avatar" aria-hidden="true">{{
                characterInitials(session)
              }}</span>
              <button
                type="button"
                class="session-main"
                rvTooltip="Open this roleplay session"
                rvTooltipPlacement="right"
                (click)="sessionSelect.emit(session.sessionId)"
              >
                <span class="name">{{
                  session.displayName || session.sessionId
                }}</span>
                <span class="meta">
                  {{ session.characterName || 'No character' }}
                  <span aria-hidden="true">/</span>
                  {{ relativeTimestamp(session) }}
                </span>
              </button>
              <button
                type="button"
                class="layer-badge"
                [attr.aria-expanded]="expandedLayerSessionId() === session.sessionId"
                rvTooltip="Show active lore layers for this session"
                rvTooltipPlacement="left"
                (click)="toggleLayerDetails(session.sessionId)"
              >
                {{ layerSummary(session) }}
              </button>
            </div>
            <p class="preview">{{ previewFor(session) }}</p>
            @if (expandedLayerSessionId() === session.sessionId) {
              <div class="layer-details">
                @for (layer of sessionLayerNames(session); track layer) {
                  <span>{{ layer }}</span>
                } @empty {
                  <span>No active lore layers.</span>
                }
              </div>
            }
            <div class="actions">
              @if (renamingId() === session.sessionId) {
                <input
                  type="text"
                  [value]="renameValue()"
                  (input)="renameValue.set(inputValue($event))"
                />
                <button
                  type="button"
                  rvTooltip="Save the new session name"
                  rvTooltipPlacement="top"
                  (click)="saveRename(session.sessionId)"
                  [disabled]="renameValue().trim() === ''"
                >
                  Save
                </button>
                <button
                  type="button"
                  rvTooltip="Cancel renaming this session"
                  rvTooltipPlacement="top"
                  (click)="cancelRename()"
                >
                  Cancel
                </button>
              } @else {
                <button
                  type="button"
                  rvTooltip="Rename this roleplay session"
                  rvTooltipPlacement="top"
                  (click)="startRename(session)"
                >
                  Rename
                </button>
                @if (session.archived) {
                  <button
                    type="button"
                    rvTooltip="Return this session to the active list"
                    rvTooltipPlacement="top"
                    (click)="sessionRestore.emit(session.sessionId)"
                  >
                    Restore
                  </button>
                } @else {
                  <button
                    type="button"
                    rvTooltip="Hide this session without deleting its history"
                    rvTooltipPlacement="top"
                    (click)="sessionArchive.emit(session.sessionId)"
                  >
                    Archive
                  </button>
                }
              }
            </div>
          </li>
        } @empty {
          <li class="empty">
            <strong>Create your first RP session</strong>
            <span>Pick a character, choose lore layers, and start a scene.</span>
            <button
              type="button"
              rvTooltip="Open the guided session creator"
              rvTooltipPlacement="top"
              (click)="startCreate()"
            >
              New Session
            </button>
          </li>
        }
      </ul>

      @if (creating()) {
        <form class="creator" (submit)="submitCreate($event)">
          <div class="steps">
            @for (item of createSteps; track item) {
              <button
                type="button"
                [rvTooltip]="createStepTooltip(item)"
                rvTooltipPlacement="bottom"
                [class.active]="step() === item"
                (click)="step.set(item)"
              >
                {{ item }}
              </button>
            }
          </div>

          @switch (step()) {
            @case ('character') {
              <label>
                Character
                <select
                  [value]="draftCharacterId()"
                  (change)="draftCharacterId.set(inputValue($event))"
                >
                  <option value="">None</option>
                  @for (character of characters(); track character.id) {
                    <option [value]="character.id">{{ character.name }}</option>
                  }
                </select>
              </label>
            }
            @case ('layers') {
              <div class="layer-list">
                @for (layer of layers(); track layer.layerId) {
                  <label>
                    <input
                      type="checkbox"
                      [checked]="draftLayerIds().includes(layer.layerId)"
                      (change)="toggleDraftLayer(layer.layerId, $event)"
                    />
                    <span>{{ layer.name }}</span>
                  </label>
                } @empty {
                  <p class="state">No lore layers.</p>
                }
              </div>
            }
            @case ('name') {
              <label>
                Name
                <input
                  name="displayName"
                  type="text"
                  [value]="draftName()"
                  (input)="draftName.set(inputValue($event))"
                />
              </label>
            }
            @case ('confirm') {
              <div class="confirm">
                <strong>{{ draftName().trim() || 'Untitled session' }}</strong>
                <span>{{ selectedCharacterName() || 'No character' }}</span>
                <span>{{ draftLayerIds().length }} layers</span>
              </div>
            }
          }

          <div class="creator-actions">
            <button
              type="button"
              rvTooltip="Close the session creator without saving"
              rvTooltipPlacement="top"
              (click)="cancelCreate()"
            >
              Cancel
            </button>
            @if (step() !== 'confirm') {
              <button
                type="button"
                rvTooltip="Continue to the next session setup step"
                rvTooltipPlacement="top"
                (click)="nextStep()"
              >
                Next
              </button>
            } @else {
              <button
                type="submit"
                rvTooltip="Create the roleplay session"
                rvTooltipPlacement="top"
                [disabled]="draftName().trim() === ''"
              >
                Create
              </button>
            }
          </div>
        </form>
      }
    </section>
  `,
  styles: [
    `
      .sessions {
        display: grid;
        gap: 0.65rem;
      }

      header,
      .toolbar,
      .actions,
      .creator-actions,
      .steps {
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

      li {
        display: grid;
        gap: 0.35rem;
        padding: 0.55rem;
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface, #fff);
      }

      li.active {
        border-color: var(--rv-color-accent, #3b82f6);
        box-shadow: 0 0 0 1px var(--rv-color-accent, #3b82f6);
      }

      li.created {
        animation: created-session 1800ms ease-out;
      }

      .card-top {
        display: grid;
        grid-template-columns: 2rem minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.45rem;
      }

      .avatar {
        display: inline-grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        background: var(--rv-color-surface-alt, #f6f7f9);
        color: var(--rv-color-text-primary, #1b1f24);
        font-size: var(--rv-font-size-xs, 0.75rem);
        font-weight: 700;
      }

      .session-main {
        min-width: 0;
        display: grid;
        gap: 0.1rem;
        padding: 0;
        border: 0;
        background: transparent;
        text-align: left;
        cursor: pointer;
      }

      .session-main:hover .name {
        color: var(--rv-color-accent, #0969da);
      }

      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
      }

      .meta,
      .preview,
      .layer-details,
      .state {
        color: var(--rv-color-text-secondary, #48515d);
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .preview {
        display: -webkit-box;
        line-height: 1.35;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
      }

      .error {
        color: var(--rv-color-danger, #cf222e);
      }

      .layer-badge {
        min-height: 1.5rem;
        max-width: 7rem;
        overflow: hidden;
        padding: 0.1rem 0.45rem;
        text-align: center;
        border-radius: 999px;
        border: 1px solid var(--rv-color-border, #d7dbe0);
        background: var(--rv-color-surface-alt, #f6f7f9);
        color: var(--rv-color-text-secondary, #48515d);
        font-size: var(--rv-font-size-xs, 0.75rem);
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
      }

      .layer-details {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
      }

      .layer-details span {
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: 999px;
        padding: 0.1rem 0.4rem;
      }

      .actions {
        justify-content: flex-end;
        flex-wrap: wrap;
      }

      .actions input {
        min-width: 0;
        flex: 1;
      }

      .empty {
        align-items: center;
        color: var(--rv-color-text-muted, #7a828d);
        gap: 0.5rem;
        justify-items: center;
        padding: 1rem;
        text-align: center;
      }

      .empty strong {
        color: var(--rv-color-text-primary, #1b1f24);
      }

      .creator {
        display: grid;
        gap: 0.55rem;
        padding: 0.65rem;
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface, #fff);
      }

      .steps {
        flex-wrap: wrap;
      }

      .steps button.active {
        outline: 2px solid currentColor;
      }

      label,
      .layer-list,
      .confirm {
        display: grid;
        gap: 0.25rem;
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .layer-list label {
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
      }

      input,
      select {
        min-width: 0;
        width: 100%;
        font: inherit;
      }

      .creator-actions {
        justify-content: flex-end;
      }

      @keyframes created-session {
        0% {
          background: color-mix(
            in srgb,
            var(--rv-color-accent, #0969da) 18%,
            var(--rv-color-surface, #fff)
          );
        }
        100% {
          background: var(--rv-color-surface, #fff);
        }
      }
    `,
  ],
})
export class RoleplaySessionPanelComponent {
  readonly sessions = input.required<readonly RoleplaySessionSummary[]>();
  readonly characters = input.required<readonly RpCharacter[]>();
  readonly layers = input.required<readonly LoreLayer[]>();
  readonly activeSessionId = input<string | null>(null);
  readonly activeSessionPreview = input<string | undefined>(undefined);
  readonly highlightedSessionId = input<string | undefined>(undefined);
  readonly loading = input<boolean>(false);
  readonly errorMessage = input<string | undefined>(undefined);

  readonly sessionSelect = output<string>();
  readonly sessionCreate = output<CreateRoleplaySessionRequest>();
  readonly sessionRename = output<UpdateRoleplaySessionRequest>();
  readonly sessionArchive = output<string>();
  readonly sessionRestore = output<string>();

  protected readonly createSteps: readonly CreateStep[] = [
    'character',
    'layers',
    'name',
    'confirm',
  ];
  protected readonly filter = signal<SessionFilter>('active');
  protected readonly creating = signal(false);
  protected readonly step = signal<CreateStep>('character');
  protected readonly draftCharacterId = signal('');
  protected readonly draftLayerIds = signal<readonly string[]>([]);
  protected readonly draftName = signal('');
  protected readonly renamingId = signal<string | undefined>(undefined);
  protected readonly renameValue = signal('');
  protected readonly expandedLayerSessionId = signal<string | undefined>(
    undefined,
  );
  protected readonly visibleSessions = computed(() => {
    const filter = this.filter();
    return [...this.sessions()]
      .filter((session) =>
        filter === 'all'
          ? true
          : filter === 'archived'
            ? session.archived
            : !session.archived,
      )
      .sort((left, right) => {
        return (
          Date.parse(right.updatedAt ?? right.createdAt ?? '') -
          Date.parse(left.updatedAt ?? left.createdAt ?? '')
        );
      });
  });
  protected readonly selectedCharacterName = computed(() => {
    const id = this.draftCharacterId();
    return this.characters().find((character) => character.id === id)?.name;
  });

  protected setFilter(event: Event): void {
    this.filter.set((event.target as HTMLSelectElement).value as SessionFilter);
  }

  protected startCreate(): void {
    this.creating.set(true);
    this.step.set('character');
    this.draftCharacterId.set('');
    this.draftLayerIds.set([]);
    this.draftName.set('');
  }

  protected cancelCreate(): void {
    this.creating.set(false);
  }

  protected toggleLayerDetails(sessionId: string): void {
    this.expandedLayerSessionId.update((current) =>
      current === sessionId ? undefined : sessionId,
    );
  }

  protected previewFor(session: RoleplaySessionSummary): string {
    const activePreview =
      session.sessionId === this.activeSessionId()
        ? this.activeSessionPreview()
        : undefined;
    return activePreview ?? session.lastMessagePreview ?? 'No messages yet.';
  }

  protected characterInitials(session: RoleplaySessionSummary): string {
    const label = session.characterName ?? session.displayName ?? session.sessionId;
    const initials = label
      .split(/\s+/)
      .filter((part) => part.length > 0)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
    return initials || '?';
  }

  protected relativeTimestamp(session: RoleplaySessionSummary): string {
    return relativeTimestamp(session.updatedAt ?? session.createdAt);
  }

  protected layerSummary(session: RoleplaySessionSummary): string {
    const count = session.activeLayerCount;
    return `${count} ${count === 1 ? 'layer' : 'layers'}`;
  }

  protected sessionLayerNames(
    session: RoleplaySessionSummary,
  ): readonly string[] {
    const layerNames = new Map(
      this.layers().map((layer) => [layer.layerId, layer.name]),
    );
    return session.activeLayerIds.map(
      (layerId) => layerNames.get(layerId) ?? layerId,
    );
  }

  protected nextStep(): void {
    const index = this.createSteps.indexOf(this.step());
    const next =
      this.createSteps[Math.min(index + 1, this.createSteps.length - 1)] ??
      'confirm';
    this.step.set(next);
  }

  protected submitCreate(event: Event): void {
    event.preventDefault();
    const displayName = this.draftName().trim();
    if (!displayName) {
      return;
    }
    const characterId = this.draftCharacterId() || undefined;
    this.sessionCreate.emit({
      displayName,
      characterId,
      activeLayerIds: this.draftLayerIds(),
    });
    this.cancelCreate();
  }

  protected toggleDraftLayer(layerId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.draftLayerIds.update((ids) =>
      checked ? [...ids, layerId] : ids.filter((id) => id !== layerId),
    );
  }

  protected startRename(session: RoleplaySessionSummary): void {
    this.renamingId.set(session.sessionId);
    this.renameValue.set(session.displayName || session.sessionId);
  }

  protected cancelRename(): void {
    this.renamingId.set(undefined);
    this.renameValue.set('');
  }

  protected saveRename(sessionId: string): void {
    const displayName = this.renameValue().trim();
    if (!displayName) {
      return;
    }
    this.sessionRename.emit({ sessionId, displayName });
    this.cancelRename();
  }

  protected createStepTooltip(step: CreateStep): string {
    switch (step) {
      case 'character':
        return 'Choose the character focus for this session';
      case 'layers':
        return 'Select the lore layers active in this session';
      case 'name':
        return 'Name the session for the session list';
      case 'confirm':
        return 'Review the session setup before creating it';
    }
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }
}

function relativeTimestamp(value: string | undefined): string {
  if (value === undefined) {
    return 'No date';
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return 'No date';
  }

  const elapsedMs = Date.now() - timestamp;
  const elapsedMinutes = Math.max(0, Math.round(elapsedMs / 60_000));
  if (elapsedMinutes < 1) {
    return 'just now';
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }
  if (elapsedHours < 48) {
    return 'yesterday';
  }

  const elapsedDays = Math.round(elapsedHours / 24);
  if (elapsedDays < 7) {
    return `${elapsedDays}d ago`;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}
