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
import {
  CharacterApi,
  RpCharacterManagerComponent,
  type CharacterUpdateRequest,
  type CharacterWriteRequest,
  type RpCharacter,
} from '@rusty-roleplay/rp-character-menu';
import {
  LORE_SOURCE,
  LoreLayerApi,
  LoreLayerPanelComponent,
  RpLorebookPanelComponent,
  type ChatLoreLayer,
  type CreateLoreLayerRequest,
  type LoreEntry,
  type LoreLayer,
  type ReorderLoreLayerRequest,
  type ToggleLoreLayerRequest,
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

import { DEMO_LOGS, DEMO_PROPOSALS } from './demo-data';
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
    RpCharacterManagerComponent,
    LoreLayerPanelComponent,
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
          <rp-character-manager
            [characters]="characters()"
            [activeId]="activeCharacterId()"
            [loading]="charactersLoading()"
            [errorMessage]="charactersError()"
            (characterActivate)="onCharacterActivate($event)"
            (characterCreate)="onCharacterCreate(profile.id, $event)"
            (characterUpdate)="onCharacterUpdate(profile.id, $event)"
            (characterArchive)="onCharacterArchive(profile.id, $event)"
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
          <rp-lore-layer-panel
            [layers]="visibleLayers()"
            [loading]="layersLoading()"
            [errorMessage]="layersError()"
            (layerToggle)="onLayerToggle($event)"
            (layerReorder)="onLayerReorder($event)"
            (layerCreate)="onLayerCreate(profile.id, $event)"
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
  private readonly loreLayerApi = inject(LoreLayerApi);
  private readonly characterApi = inject(CharacterApi);

  protected readonly campaignId = 'eldoria';
  protected readonly characters = signal<readonly RpCharacter[]>([]);
  protected readonly lore = signal<readonly LoreEntry[]>([]);
  protected readonly proposals = DEMO_PROPOSALS;
  protected readonly logs = DEMO_LOGS;

  protected readonly activeCharacterId = signal<string | undefined>(undefined);
  protected readonly mood = signal<SceneMood>('tense');
  protected readonly mode = signal<RpMode>('roleplay');
  protected readonly selectError = signal<string | undefined>(undefined);
  protected readonly sessionError = signal<string | undefined>(undefined);
  protected readonly charactersLoading = signal(false);
  protected readonly charactersError = signal<string | undefined>(undefined);
  protected readonly layersLoading = signal(false);
  protected readonly layersError = signal<string | undefined>(undefined);
  protected readonly profileLayers = signal<readonly LoreLayer[]>([]);
  protected readonly chatLayers = signal<readonly ChatLoreLayer[]>([]);

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
  protected readonly visibleLayers = computed<readonly ChatLoreLayer[]>(() => {
    const chatLayers = this.chatLayers();
    const byId = new Map(chatLayers.map((layer) => [layer.layerId, layer]));
    const merged = this.profileLayers().map((layer, index) => {
      const chatLayer = byId.get(layer.layerId);
      if (chatLayer !== undefined) {
        return chatLayer;
      }
      return {
        ...layer,
        enabled: false,
        priority: chatLayers.length + index,
      };
    });
    for (const layer of chatLayers) {
      if (
        !merged.some((profileLayer) => profileLayer.layerId === layer.layerId)
      ) {
        merged.push(layer);
      }
    }
    return merged.sort((left, right) => left.priority - right.priority);
  });

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

  protected onCharacterActivate(characterId: string): void {
    this.activeCharacterId.set(characterId);
    const sessionId = this.chatStore.activeSessionId();
    if (sessionId !== null) {
      void this.setSessionCharacter(sessionId, characterId);
    }
  }

  protected onCharacterCreate(
    profileId: string,
    request: CharacterWriteRequest,
  ): void {
    void this.createCharacter(profileId, request);
  }

  protected onCharacterUpdate(
    profileId: string,
    request: CharacterUpdateRequest,
  ): void {
    void this.updateCharacter(profileId, request);
  }

  protected onCharacterArchive(profileId: string, characterId: string): void {
    void this.archiveCharacter(profileId, characterId);
  }

  protected onLayerToggle(request: ToggleLoreLayerRequest): void {
    const sessionId = this.chatStore.activeSessionId();
    if (sessionId === null) {
      return;
    }
    void this.toggleLayer(sessionId, request);
  }

  protected onLayerReorder(request: ReorderLoreLayerRequest): void {
    const sessionId = this.chatStore.activeSessionId();
    if (sessionId === null) {
      return;
    }
    void this.reorderLayers(sessionId, request);
  }

  protected onLayerCreate(
    profileId: string,
    request: CreateLoreLayerRequest,
  ): void {
    void this.createLayer(profileId, request);
  }

  private async connectToProfile(profileId: string): Promise<void> {
    this.sessionError.set(undefined);
    try {
      void this.loadCharacters(profileId);
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
      await this.loadLoreLayers(profileId, selected.session_id);
    } catch (error: unknown) {
      this.sessionError.set(readErrorMessage(error));
    }
  }

  private async loadCharacters(profileId: string): Promise<void> {
    this.charactersLoading.set(true);
    this.charactersError.set(undefined);
    try {
      const characters = await this.characterApi.listCharacters(profileId);
      this.characters.set(characters);
      const activeId = this.activeCharacterId();
      if (
        activeId !== undefined &&
        !characters.some((character) => character.id === activeId)
      ) {
        this.activeCharacterId.set(undefined);
      }
    } catch (error: unknown) {
      this.charactersError.set(readErrorMessage(error));
    } finally {
      this.charactersLoading.set(false);
    }
  }

  private async createCharacter(
    profileId: string,
    request: CharacterWriteRequest,
  ): Promise<void> {
    this.charactersError.set(undefined);
    try {
      const character = await this.characterApi.createCharacter(
        profileId,
        request,
      );
      this.characters.update((characters) => [...characters, character]);
      this.activeCharacterId.set(character.id);
      const sessionId = this.chatStore.activeSessionId();
      if (sessionId !== null) {
        await this.setSessionCharacter(sessionId, character.id);
      }
    } catch (error: unknown) {
      this.charactersError.set(readErrorMessage(error));
    }
  }

  private async updateCharacter(
    profileId: string,
    request: CharacterUpdateRequest,
  ): Promise<void> {
    this.charactersError.set(undefined);
    try {
      const character = await this.characterApi.updateCharacter(
        profileId,
        request,
      );
      this.characters.update((characters) =>
        characters.map((item) => (item.id === character.id ? character : item)),
      );
    } catch (error: unknown) {
      this.charactersError.set(readErrorMessage(error));
    }
  }

  private async archiveCharacter(
    profileId: string,
    characterId: string,
  ): Promise<void> {
    this.charactersError.set(undefined);
    try {
      await this.characterApi.archiveCharacter(profileId, characterId);
      this.characters.update((characters) =>
        characters.filter((character) => character.id !== characterId),
      );
      if (this.activeCharacterId() === characterId) {
        this.activeCharacterId.set(undefined);
      }
    } catch (error: unknown) {
      this.charactersError.set(readErrorMessage(error));
    }
  }

  private async setSessionCharacter(
    sessionId: string,
    characterId: string,
  ): Promise<void> {
    this.charactersError.set(undefined);
    try {
      await this.characterApi.setSessionCharacter(sessionId, characterId);
    } catch (error: unknown) {
      this.charactersError.set(readErrorMessage(error));
    }
  }

  private async loadLoreLayers(
    profileId: string,
    sessionId: string,
  ): Promise<void> {
    this.layersLoading.set(true);
    this.layersError.set(undefined);
    try {
      const [profileLayers, chatLayers] = await Promise.all([
        this.loreLayerApi.listProfileLayers(profileId),
        this.loreLayerApi.getChatLayers(sessionId),
      ]);
      this.profileLayers.set(profileLayers);
      this.chatLayers.set(chatLayers);
    } catch (error: unknown) {
      this.layersError.set(readErrorMessage(error));
    } finally {
      this.layersLoading.set(false);
    }
  }

  private async createLayer(
    profileId: string,
    request: CreateLoreLayerRequest,
  ): Promise<void> {
    this.layersError.set(undefined);
    try {
      const layer = await this.loreLayerApi.createLayer(profileId, request);
      this.profileLayers.update((layers) => [...layers, layer]);
    } catch (error: unknown) {
      this.layersError.set(readErrorMessage(error));
    }
  }

  private async toggleLayer(
    sessionId: string,
    request: ToggleLoreLayerRequest,
  ): Promise<void> {
    this.layersError.set(undefined);
    try {
      const attachedIds = this.chatLayers().map((layer) => layer.layerId);
      if (request.enabled && !attachedIds.includes(request.layerId)) {
        await this.loreLayerApi.setChatLayers(sessionId, [
          ...attachedIds,
          request.layerId,
        ]);
      } else {
        await this.loreLayerApi.toggleChatLayer(
          sessionId,
          request.layerId,
          request.enabled,
        );
      }
      this.chatLayers.set(await this.loreLayerApi.getChatLayers(sessionId));
    } catch (error: unknown) {
      this.layersError.set(readErrorMessage(error));
    }
  }

  private async reorderLayers(
    sessionId: string,
    request: ReorderLoreLayerRequest,
  ): Promise<void> {
    this.layersError.set(undefined);
    try {
      const ordered = [...this.chatLayers()].sort(
        (left, right) => left.priority - right.priority,
      );
      const index = ordered.findIndex(
        (layer) => layer.layerId === request.layerId,
      );
      const targetIndex = request.direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
        return;
      }
      const next = [...ordered];
      const [moved] = next.splice(index, 1);
      if (moved === undefined) {
        return;
      }
      next.splice(targetIndex, 0, moved);
      await this.loreLayerApi.reorderChatLayers(
        sessionId,
        next.map((layer) => layer.layerId),
      );
      this.chatLayers.set(await this.loreLayerApi.getChatLayers(sessionId));
    } catch (error: unknown) {
      this.layersError.set(readErrorMessage(error));
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
