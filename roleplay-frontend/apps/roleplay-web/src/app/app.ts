import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import type { ChatMessage } from '@rusty-view/chat-domain';
import {
  ProfileStore,
  RpProfileSelectorComponent,
  type ProfileSelection,
} from '@rusty-roleplay/rp-profile';
import { RpLayoutComponent } from '@rusty-roleplay/rp-layout';
import { RpCharacterMenuComponent } from '@rusty-roleplay/rp-character-menu';
import {
  LORE_SOURCE,
  RpLorebookPanelComponent,
  type LoreEntry,
} from '@rusty-roleplay/rp-lorebook';
import {
  RpSceneControlsComponent,
  type NarratorPhase,
  type SceneMood,
} from '@rusty-roleplay/rp-scene-controls';
import {
  RpMechanicPanelComponent,
  type RpMode,
} from '@rusty-roleplay/rp-mechanic';

import {
  DEMO_CHARACTERS,
  DEMO_LOGS,
  DEMO_MESSAGES,
  DEMO_PROPOSALS,
} from './demo-data';

/**
 * Roleplay-web shell. Container component: it injects ProfileStore, gates the
 * app behind profile selection, and composes the RP layout with the RP-specific
 * sidebar and panel content. The transcript itself is rendered by rusty-view's
 * imported components inside RpLayoutComponent.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RpProfileSelectorComponent,
    RpLayoutComponent,
    RpCharacterMenuComponent,
    RpLorebookPanelComponent,
    RpSceneControlsComponent,
    RpMechanicPanelComponent,
  ],
  template: `
    @if (profileStore.activeProfile(); as profile) {
      <rp-layout
        [messages]="messages()"
        [profileName]="profile.name"
        connectionStatus="connected"
        [sceneLabel]="sceneLabel()"
        (send)="onSend($event)"
      >
        <div rpSidebar>
          <rp-character-menu
            [characters]="characters"
            [activeId]="activeCharacterId()"
            (activate)="activeCharacterId.set($event)"
          />
        </div>
        <div rpPanel class="rp-panel-stack">
          <rp-scene-controls
            [phase]="phase()"
            [mood]="mood()"
            (moodChange)="mood.set($event)"
          />
          <rp-lorebook-panel
            [entries]="lore()"
            (selectEntry)="onLoreSelected($event)"
          />
          <rp-mechanic-panel
            [mode]="mode()"
            [proposals]="proposals"
            [logs]="logs"
            (modeChange)="mode.set($event)"
          />
        </div>
      </rp-layout>
    } @else {
      <rp-profile-selector
        [profiles]="profileStore.profiles()"
        [errorMessage]="selectError()"
        (selectProfile)="onProfileSelect($event)"
      />
    }
  `,
  styles: [
    `
      .rp-panel-stack {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        height: 100%;
      }
    `,
  ],
})
export class App {
  protected readonly profileStore = inject(ProfileStore);
  private readonly loreSource = inject(LORE_SOURCE);

  protected readonly campaignId = 'eldoria';
  protected readonly messages = signal<readonly ChatMessage[]>(DEMO_MESSAGES);
  protected readonly characters = DEMO_CHARACTERS;
  protected readonly lore = signal<readonly LoreEntry[]>([]);
  protected readonly proposals = DEMO_PROPOSALS;
  protected readonly logs = DEMO_LOGS;

  protected readonly activeCharacterId = signal<string | undefined>('xavier');
  protected readonly phase = signal<NarratorPhase>('idle');
  protected readonly mood = signal<SceneMood>('tense');
  protected readonly mode = signal<RpMode>('roleplay');
  protected readonly sceneLabel = signal('Northmarch — the northern road');
  protected readonly selectError = signal<string | undefined>(undefined);

  constructor() {
    // Lore comes through the LoreSource boundary (mock today, lorekeep HTTP later).
    void this.loreSource
      .searchEntries(this.campaignId, '')
      .then((entries) => this.lore.set(entries));
  }

  protected onProfileSelect(selection: ProfileSelection): void {
    const result = this.profileStore.select(
      selection.profileId,
      selection.password,
    );
    this.selectError.set(
      result.ok
        ? undefined
        : result.reason === 'wrong_password'
          ? 'Incorrect password.'
          : 'Unknown profile.',
    );
  }

  protected onSend(text: string): void {
    const id = `m${this.messages().length + 1}`;
    const message: ChatMessage = {
      id,
      sessionId: 'rp-session-a',
      author: { role: 'user', displayName: 'Xavier' },
      createdAt: new Date().toISOString(),
      status: 'completed',
      blocks: [
        {
          id: `${id}-b0`,
          messageId: id,
          kind: 'text',
          content: text,
          estimatedHeight: undefined,
          renderPolicy: 'full',
        },
      ],
    };
    this.messages.update((list) => [...list, message]);
  }

  protected onLoreSelected(entry: LoreEntry): void {
    this.sceneLabel.set(`Lore: ${entry.title}`);
  }
}
