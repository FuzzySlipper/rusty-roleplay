import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ChatStore } from '@rusty-view/chat-store';
import type { StreamStatusKind } from '@rusty-view/chat-components';
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

import { DEMO_CHARACTERS, DEMO_LOGS, DEMO_PROPOSALS } from './demo-data';
import { deriveNarratorPhase } from './narrator-phase';

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
        [messages]="chatStore.messages()"
        [profileName]="profile.name"
        [connectionStatus]="connectionStatus()"
        [phase]="phase()"
        [sceneLabel]="sceneLabel()"
        [sendDisabled]="sendDisabled()"
        (send)="onSend($event)"
        (reconnect)="onReconnect()"
      >
        <div rpSidebar>
          @if (sessionError(); as error) {
            <p class="session-error">{{ error }}</p>
          }
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

      .session-error {
        margin: 0 0 0.75rem;
        color: var(--rv-color-danger, #cf222e);
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }
    `,
  ],
})
export class App {
  protected readonly profileStore = inject(ProfileStore);
  protected readonly chatStore = inject(ChatStore);
  private readonly loreSource = inject(LORE_SOURCE);

  protected readonly campaignId = 'eldoria';
  protected readonly characters = DEMO_CHARACTERS;
  protected readonly lore = signal<readonly LoreEntry[]>([]);
  protected readonly proposals = DEMO_PROPOSALS;
  protected readonly logs = DEMO_LOGS;

  protected readonly activeCharacterId = signal<string | undefined>('xavier');
  protected readonly mood = signal<SceneMood>('tense');
  protected readonly mode = signal<RpMode>('roleplay');
  protected readonly selectError = signal<string | undefined>(undefined);
  protected readonly sessionError = signal<string | undefined>(undefined);

  protected readonly phase = computed<NarratorPhase>(() =>
    deriveNarratorPhase(this.chatStore.rawEvents()),
  );
  protected readonly sceneLabel = computed(() => {
    const session = this.chatStore.activeSession();
    return session?.title ?? session?.session_id ?? 'No session selected';
  });
  protected readonly connectionStatus = computed<StreamStatusKind>(() =>
    toStreamStatus(this.chatStore.connectionState().status),
  );
  protected readonly sendDisabled = computed(
    () =>
      this.chatStore.activeSessionId() === null ||
      this.chatStore.activeSession()?.status === 'archived' ||
      this.chatStore.pendingSends().some((send) => send.status === 'sending'),
  );

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
    if (result.ok) {
      void this.connectToProfile(selection.profileId);
    }
  }

  protected onSend(text: string): void {
    void this.chatStore.sendMessage(text).catch((error: unknown) => {
      this.sessionError.set(readErrorMessage(error));
    });
  }

  protected onReconnect(): void {
    void this.chatStore.reconnect().catch((error: unknown) => {
      this.sessionError.set(readErrorMessage(error));
    });
  }

  protected onLoreSelected(entry: LoreEntry): void {
    this.sessionError.set(`Selected lore: ${entry.title}`);
  }

  private async connectToProfile(profileId: string): Promise<void> {
    this.sessionError.set(undefined);
    try {
      await this.chatStore.refreshSessions();
      const sessions = this.chatStore.sessions();
      const matching = sessions.find(
        (session) =>
          session.profile_id === profileId && session.status !== 'archived',
      );
      const fallback = sessions.find(
        (session) => session.status !== 'archived',
      );
      const selected = matching ?? fallback ?? sessions[0];
      if (selected === undefined) {
        this.sessionError.set(
          'No chat sessions are available from rusty-crew.',
        );
        return;
      }
      if (selected.status === 'archived') {
        this.sessionError.set(
          'Only archived chat sessions are available; opening read-only history.',
        );
      }
      await this.chatStore.selectSession(selected.session_id);
    } catch (error: unknown) {
      this.sessionError.set(readErrorMessage(error));
    }
  }
}

function toStreamStatus(status: string): StreamStatusKind {
  switch (status) {
    case 'connecting':
    case 'connected':
    case 'reconnecting':
    case 'closed':
    case 'error':
      return status;
    case 'idle':
    default:
      return 'idle';
  }
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
