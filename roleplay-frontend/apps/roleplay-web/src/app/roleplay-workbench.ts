import { computed, inject, Injectable, signal } from '@angular/core';
import { ChatStore } from '@rusty-view/chat-store';
import type { StreamStatusKind } from '@rusty-view/chat-components';
import {
  ProfileStore,
  type ProfileSelection,
} from '@rusty-roleplay/rp-profile';
import {
  CharacterApi,
  type CharacterUpdateRequest,
  type CharacterWriteRequest,
  type RpCharacter,
} from '@rusty-roleplay/rp-character-menu';
import {
  annotateLoreEntryLayer,
  LORE_SOURCE,
  LoreEntryApi,
  type LoreEntryEditRequest,
  LoreLayerApi,
  type ChatLoreLayer,
  type CreateLoreLayerRequest,
  type LoreEntry,
  type LoreLayer,
  type PromoteLoreEntryRequest,
  type ReorderLoreLayerRequest,
  type ToggleLoreLayerRequest,
} from '@rusty-roleplay/rp-lorebook';
import type {
  NarratorPhase,
  SceneMood,
} from '@rusty-roleplay/rp-scene-controls';
import type { RpMode } from '@rusty-roleplay/rp-mechanic';

import { DEMO_LOGS, DEMO_PROPOSALS } from './demo-data';
import { deriveNarratorPhase } from './narrator-phase';
import { NarratorConfigApi } from './narrator-config/narrator-config-api';
import type { NarratorConfig } from './narrator-config/narrator-config.model';
import { ProfileRegistryApi } from './profile-registry/profile-registry-api';
import { RoleplaySessionApi } from './session-management/roleplay-session-api';
import type {
  CreateRoleplaySessionRequest,
  RoleplaySessionSummary,
  UpdateRoleplaySessionRequest,
} from './session-management/roleplay-session.model';

@Injectable()
export class RoleplayWorkbench {
  readonly profileStore = inject(ProfileStore);
  readonly chatStore = inject(ChatStore);
  private readonly loreSource = inject(LORE_SOURCE);
  private readonly loreEntryApi = inject(LoreEntryApi);
  private readonly loreLayerApi = inject(LoreLayerApi);
  private readonly characterApi = inject(CharacterApi);
  private readonly roleplaySessionApi = inject(RoleplaySessionApi);
  private readonly narratorConfigApi = inject(NarratorConfigApi);
  private readonly profileRegistryApi = inject(ProfileRegistryApi);

  readonly campaignId = 'eldoria';
  readonly characters = signal<readonly RpCharacter[]>([]);
  readonly lore = signal<readonly LoreEntry[]>([]);
  readonly selectedLore = signal<LoreEntry | null>(null);
  readonly loreLoading = signal(false);
  readonly loreSaving = signal(false);
  readonly promotingLoreEntryId = signal<string | undefined>(undefined);
  readonly loreError = signal<string | undefined>(undefined);
  readonly loreQuery = signal('');
  readonly proposals = DEMO_PROPOSALS;
  readonly logs = DEMO_LOGS;

  readonly activeCharacterId = signal<string | undefined>(undefined);
  readonly mood = signal<SceneMood>('tense');
  readonly mode = signal<RpMode>('roleplay');
  readonly selectError = signal<string | undefined>(undefined);
  readonly sessionError = signal<string | undefined>(undefined);
  readonly sessionsLoading = signal(false);
  readonly sessionsError = signal<string | undefined>(undefined);
  readonly roleplaySessions = signal<readonly RoleplaySessionSummary[]>([]);
  readonly charactersLoading = signal(false);
  readonly charactersError = signal<string | undefined>(undefined);
  readonly layersLoading = signal(false);
  readonly layersError = signal<string | undefined>(undefined);
  readonly profileLayers = signal<readonly LoreLayer[]>([]);
  readonly chatLayers = signal<readonly ChatLoreLayer[]>([]);
  readonly narratorConfig = signal<NarratorConfig | null>(null);
  readonly narratorConfigLoading = signal(false);
  readonly narratorConfigSaving = signal(false);
  readonly narratorConfigError = signal<string | undefined>(undefined);
  readonly transcriptSearchEnabled = signal(false);
  private loreRequestId = 0;

  readonly activeProfile = this.profileStore.activeProfile;
  readonly phase = computed<NarratorPhase>(() =>
    deriveNarratorPhase(this.chatStore.rawEvents()),
  );
  readonly activeRoleplaySession = computed(() => {
    const sessionId = this.chatStore.activeSessionId();
    return (
      this.roleplaySessions().find(
        (session) => session.sessionId === sessionId,
      ) ?? null
    );
  });
  readonly sceneLabel = computed(() => {
    const roleplaySession = this.activeRoleplaySession();
    if (roleplaySession?.displayName) {
      return roleplaySession.displayName;
    }
    const session = this.chatStore.activeSession();
    return session?.title ?? session?.session_id ?? 'No session selected';
  });
  readonly connectionStatus = computed<StreamStatusKind>(() =>
    toStreamStatus(this.chatStore.connectionState().status),
  );
  readonly sendDisabled = computed(
    () =>
      this.chatStore.activeSessionId() === null ||
      this.chatStore.activeSession()?.status === 'archived' ||
      this.chatStore.pendingSends().some((send) => send.status === 'sending'),
  );
  readonly visibleLayers = computed<readonly ChatLoreLayer[]>(() => {
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
  readonly writableLoreLayers = computed(() =>
    this.visibleLayers().filter(
      (layer) => !layer.archived && layer.writePolicy !== 'readonly',
    ),
  );
  readonly promoteTargetLayers = computed(() =>
    this.visibleLayers().filter(
      (layer) => !layer.archived && layer.writePolicy === 'manual',
    ),
  );

  constructor() {
    void this.loadProfiles();
  }

  async loadProfiles(): Promise<void> {
    try {
      const profiles = await this.profileRegistryApi.listProfiles();
      if (profiles.length > 0) {
        this.profileStore.setProfiles(profiles);
      }
    } catch (error: unknown) {
      this.selectError.set(readErrorMessage(error));
    }
  }

  selectProfile(selection: ProfileSelection): void {
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

  send(text: string): void {
    void this.chatStore.sendMessage(text).catch((error: unknown) => {
      this.sessionError.set(readErrorMessage(error));
    });
  }

  reconnect(): void {
    void this.chatStore.reconnect().catch((error: unknown) => {
      this.sessionError.set(readErrorMessage(error));
    });
  }

  toggleTranscriptSearch(): void {
    this.transcriptSearchEnabled.update((enabled) => !enabled);
  }

  selectLore(entry: LoreEntry): void {
    this.sessionError.set(undefined);
    this.selectedLore.set(entry);
    this.lore.update((entries) =>
      entries.some((item) => item.slug === entry.slug)
        ? entries
        : [entry, ...entries],
    );
    void this.loadLoreEntryDetail(entry.recordId);
  }

  searchLore(query: string): void {
    this.loreQuery.set(query);
    void this.loadLoreEntries();
  }

  selectSession(profileId: string, sessionId: string): void {
    void this.selectRoleplaySession(profileId, sessionId);
  }

  createSession(
    profileId: string,
    request: CreateRoleplaySessionRequest,
  ): void {
    void this.createRoleplaySession(profileId, request);
  }

  renameSession(request: UpdateRoleplaySessionRequest): void {
    void this.renameRoleplaySession(request);
  }

  archiveSession(profileId: string, sessionId: string): void {
    void this.archiveRoleplaySession(profileId, sessionId);
  }

  restoreSession(profileId: string, sessionId: string): void {
    void this.restoreRoleplaySession(profileId, sessionId);
  }

  activateCharacter(characterId: string): void {
    this.activeCharacterId.set(characterId);
    const sessionId = this.chatStore.activeSessionId();
    if (sessionId !== null) {
      void this.setSessionCharacter(sessionId, characterId);
    }
  }

  createCharacter(profileId: string, request: CharacterWriteRequest): void {
    void this.createCharacterRecord(profileId, request);
  }

  updateCharacter(profileId: string, request: CharacterUpdateRequest): void {
    void this.updateCharacterRecord(profileId, request);
  }

  archiveCharacter(profileId: string, characterId: string): void {
    void this.archiveCharacterRecord(profileId, characterId);
  }

  toggleLayer(request: ToggleLoreLayerRequest): void {
    const sessionId = this.chatStore.activeSessionId();
    if (sessionId === null) {
      return;
    }
    void this.toggleChatLayer(sessionId, request);
  }

  reorderLayer(request: ReorderLoreLayerRequest): void {
    const sessionId = this.chatStore.activeSessionId();
    if (sessionId === null) {
      return;
    }
    void this.reorderChatLayers(sessionId, request);
  }

  createLayer(profileId: string, request: CreateLoreLayerRequest): void {
    void this.createProfileLayer(profileId, request);
  }

  createLoreEntry(
    profileId: string,
    request: LoreEntryEditRequest,
  ): Promise<boolean> {
    return this.createLoreEntryRecord(profileId, request);
  }

  updateLoreEntry(
    profileId: string,
    request: LoreEntryEditRequest,
  ): Promise<boolean> {
    return this.updateLoreEntryRecord(profileId, request);
  }

  promoteLoreEntry(request: PromoteLoreEntryRequest): void {
    void this.promoteLoreEntryRecord(request);
  }

  reloadNarratorConfig(profileId: string): void {
    void this.loadNarratorConfig(profileId);
  }

  saveNarratorConfig(profileId: string, config: NarratorConfig): void {
    void this.saveNarratorConfigRecord(profileId, config);
  }

  private async connectToProfile(profileId: string): Promise<void> {
    this.sessionError.set(undefined);
    try {
      const [roleplaySessions] = await Promise.all([
        this.loadRoleplaySessions(profileId),
        this.loadCharacters(profileId),
        this.loadProfileLayers(profileId),
        this.loadNarratorConfig(profileId),
        this.chatStore.refreshSessions(),
      ]);
      const genericSessions = this.chatStore.sessions();
      const roleplaySelection =
        roleplaySessions.find((session) => !session.archived) ??
        roleplaySessions.find((session) => session.archived);
      const matching = genericSessions.find(
        (session) =>
          session.profile_id === profileId && session.status !== 'archived',
      );
      const fallback = genericSessions.find(
        (session) => session.status !== 'archived',
      );
      const selectedId =
        roleplaySelection?.sessionId ??
        matching?.session_id ??
        fallback?.session_id ??
        genericSessions[0]?.session_id;
      const selected = genericSessions.find(
        (session) => session.session_id === selectedId,
      );
      if (selected === undefined) {
        this.sessionError.set(
          'No chat sessions are available from rusty-crew. Create a session to begin.',
        );
        return;
      }
      if (selected.status === 'archived') {
        this.sessionError.set(
          'Only archived chat sessions are available; opening read-only history.',
        );
      }
      await this.chatStore.selectSession(selected.session_id);
      this.syncActiveCharacterFromSession(selected.session_id);
      await this.loadChatLayers(selected.session_id);
      await this.loadLoreEntries();
    } catch (error: unknown) {
      this.sessionError.set(readErrorMessage(error));
    }
  }

  private async loadRoleplaySessions(
    profileId: string,
  ): Promise<readonly RoleplaySessionSummary[]> {
    this.sessionsLoading.set(true);
    this.sessionsError.set(undefined);
    try {
      const sessions = await this.roleplaySessionApi.listSessions(profileId);
      this.roleplaySessions.set(sessions);
      return sessions;
    } catch (error: unknown) {
      this.sessionsError.set(readErrorMessage(error));
      return [];
    } finally {
      this.sessionsLoading.set(false);
    }
  }

  private async selectRoleplaySession(
    profileId: string,
    sessionId: string,
  ): Promise<void> {
    this.sessionError.set(undefined);
    try {
      await this.chatStore.refreshSessions();
      await this.chatStore.selectSession(sessionId);
      this.syncActiveCharacterFromSession(sessionId);
      await this.loadChatLayers(sessionId);
      await this.loadLoreEntries();
      void this.loadRoleplaySessions(profileId);
    } catch (error: unknown) {
      this.sessionError.set(readErrorMessage(error));
    }
  }

  private async createRoleplaySession(
    profileId: string,
    request: CreateRoleplaySessionRequest,
  ): Promise<void> {
    this.sessionsError.set(undefined);
    try {
      const session = await this.roleplaySessionApi.createSession(
        profileId,
        request,
      );
      this.roleplaySessions.update((sessions) =>
        upsertSession(sessions, session),
      );
      await this.chatStore.refreshSessions();
      await this.chatStore.selectSession(session.sessionId);
      this.activeCharacterId.set(session.characterId);
      await this.loadChatLayers(session.sessionId);
      await this.loadLoreEntries();
    } catch (error: unknown) {
      this.sessionsError.set(readErrorMessage(error));
    }
  }

  private async renameRoleplaySession(
    request: UpdateRoleplaySessionRequest,
  ): Promise<void> {
    this.sessionsError.set(undefined);
    try {
      const session = await this.roleplaySessionApi.updateSession(request);
      this.roleplaySessions.update((sessions) =>
        upsertSession(sessions, session),
      );
    } catch (error: unknown) {
      this.sessionsError.set(readErrorMessage(error));
    }
  }

  private async archiveRoleplaySession(
    profileId: string,
    sessionId: string,
  ): Promise<void> {
    this.sessionsError.set(undefined);
    try {
      const archived = await this.roleplaySessionApi.archiveSession(sessionId);
      this.roleplaySessions.update((sessions) =>
        upsertSession(sessions, archived),
      );
      await this.chatStore.refreshSessions();
      if (this.chatStore.activeSessionId() === sessionId) {
        const next = this.roleplaySessions().find(
          (session) => !session.archived && session.sessionId !== sessionId,
        );
        if (next !== undefined) {
          await this.selectRoleplaySession(profileId, next.sessionId);
        }
      }
    } catch (error: unknown) {
      this.sessionsError.set(readErrorMessage(error));
    }
  }

  private async restoreRoleplaySession(
    profileId: string,
    sessionId: string,
  ): Promise<void> {
    this.sessionsError.set(undefined);
    try {
      const restored = await this.roleplaySessionApi.restoreSession(sessionId);
      this.roleplaySessions.update((sessions) =>
        upsertSession(sessions, restored),
      );
      await this.chatStore.refreshSessions();
      await this.selectRoleplaySession(profileId, restored.sessionId);
    } catch (error: unknown) {
      this.sessionsError.set(readErrorMessage(error));
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

  private async loadNarratorConfig(profileId: string): Promise<void> {
    this.narratorConfigLoading.set(true);
    this.narratorConfigError.set(undefined);
    try {
      const config = await this.narratorConfigApi.readConfig(profileId);
      this.narratorConfig.set(config);
    } catch (error: unknown) {
      this.narratorConfigError.set(readErrorMessage(error));
    } finally {
      this.narratorConfigLoading.set(false);
    }
  }

  private async saveNarratorConfigRecord(
    profileId: string,
    config: NarratorConfig,
  ): Promise<void> {
    this.narratorConfigSaving.set(true);
    this.narratorConfigError.set(undefined);
    try {
      const saved = await this.narratorConfigApi.saveConfig(profileId, config);
      this.narratorConfig.set(saved);
    } catch (error: unknown) {
      this.narratorConfigError.set(readErrorMessage(error));
    } finally {
      this.narratorConfigSaving.set(false);
    }
  }

  private async createCharacterRecord(
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

  private async updateCharacterRecord(
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

  private async archiveCharacterRecord(
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
      const session = await this.roleplaySessionApi.updateSession({
        sessionId,
        characterId,
      });
      this.roleplaySessions.update((sessions) =>
        upsertSession(sessions, session),
      );
    } catch (error: unknown) {
      this.charactersError.set(readErrorMessage(error));
    }
  }

  private syncActiveCharacterFromSession(sessionId: string): void {
    const session = this.roleplaySessions().find(
      (candidate) => candidate.sessionId === sessionId,
    );
    this.activeCharacterId.set(session?.characterId);
  }

  private async loadProfileLayers(profileId: string): Promise<void> {
    this.layersLoading.set(true);
    this.layersError.set(undefined);
    try {
      this.profileLayers.set(
        await this.loreLayerApi.listProfileLayers(profileId),
      );
    } catch (error: unknown) {
      this.layersError.set(readErrorMessage(error));
    } finally {
      this.layersLoading.set(false);
    }
  }

  private async loadChatLayers(sessionId: string): Promise<void> {
    this.layersLoading.set(true);
    this.layersError.set(undefined);
    try {
      this.chatLayers.set(await this.loreLayerApi.getChatLayers(sessionId));
    } catch (error: unknown) {
      this.layersError.set(readErrorMessage(error));
    } finally {
      this.layersLoading.set(false);
    }
  }

  private async createProfileLayer(
    profileId: string,
    request: CreateLoreLayerRequest,
  ): Promise<void> {
    this.layersError.set(undefined);
    try {
      const layer = await this.loreLayerApi.createLayer(profileId, request);
      this.profileLayers.update((layers) => [...layers, layer]);
      await this.loadLoreEntries();
    } catch (error: unknown) {
      this.layersError.set(readErrorMessage(error));
    }
  }

  private async toggleChatLayer(
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
      await this.loadLoreEntries();
    } catch (error: unknown) {
      this.layersError.set(readErrorMessage(error));
    }
  }

  private async reorderChatLayers(
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
      await this.loadLoreEntries();
    } catch (error: unknown) {
      this.layersError.set(readErrorMessage(error));
    }
  }

  private async loadLoreEntries(): Promise<void> {
    const profileId = this.activeProfile()?.id;
    if (profileId === undefined) {
      this.lore.set([]);
      return;
    }
    const requestId = ++this.loreRequestId;
    this.loreLoading.set(true);
    this.loreError.set(undefined);
    try {
      const sessionId = this.chatStore.activeSessionId() ?? undefined;
      const entries = await this.loreSource.searchEntries(
        this.campaignId,
        this.loreQuery(),
        {
          profileId,
          ...(sessionId !== undefined ? { chatId: sessionId } : {}),
          limit: 100,
          offset: 0,
        },
      );
      const annotatedEntries =
        await this.annotateAutoCaptureLoreEntries(entries);
      if (requestId === this.loreRequestId) {
        this.lore.set(annotatedEntries);
        const selected = this.selectedLore();
        if (
          selected !== null &&
          !annotatedEntries.some(
            (entry) => entry.recordId === selected.recordId,
          )
        ) {
          this.selectedLore.set(null);
        }
      }
    } catch (error: unknown) {
      if (requestId === this.loreRequestId) {
        this.loreError.set(readErrorMessage(error));
      }
    } finally {
      if (requestId === this.loreRequestId) {
        this.loreLoading.set(false);
      }
    }
  }

  private async loadLoreEntryDetail(recordId: string): Promise<void> {
    const profileId = this.activeProfile()?.id;
    this.loreError.set(undefined);
    try {
      const entry = await this.loreEntryApi.readEntry(recordId, {
        ...(profileId !== undefined ? { profileId } : {}),
        ...this.loreDetailScope(),
      });
      if (entry === null) {
        return;
      }
      this.selectedLore.set(entry);
      this.lore.update((entries) => upsertLoreEntry(entries, entry));
    } catch (error: unknown) {
      this.loreError.set(readErrorMessage(error));
    }
  }

  private async createLoreEntryRecord(
    profileId: string,
    request: LoreEntryEditRequest,
  ): Promise<boolean> {
    const layer = this.writableLoreLayers()[0];
    if (layer === undefined) {
      this.loreError.set('Create a writable lore layer before adding lore.');
      return false;
    }
    this.loreSaving.set(true);
    this.loreError.set(undefined);
    try {
      const entry = await this.loreEntryApi.createEntry({
        ...request,
        layerId: layer.layerId,
        worldId: profileId,
      });
      this.selectedLore.set(entry);
      this.lore.update((entries) => upsertLoreEntry(entries, entry));
      await this.loadProfileLayers(profileId);
      const sessionId = this.chatStore.activeSessionId();
      if (sessionId !== null) {
        await this.loadChatLayers(sessionId);
      }
      return true;
    } catch (error: unknown) {
      this.loreError.set(readErrorMessage(error));
      return false;
    } finally {
      this.loreSaving.set(false);
    }
  }

  private async updateLoreEntryRecord(
    profileId: string,
    request: LoreEntryEditRequest,
  ): Promise<boolean> {
    const selected = this.selectedLore();
    if (selected === null) {
      this.loreError.set('Select a lore entry before saving changes.');
      return false;
    }
    if (selected.revision < 1) {
      this.loreError.set('Reload the lore entry before saving changes.');
      return false;
    }
    this.loreSaving.set(true);
    this.loreError.set(undefined);
    try {
      const entry = await this.loreEntryApi.updateEntry({
        ...request,
        recordId: selected.recordId,
        expectedRevision: selected.revision,
        scope: {
          profileId,
          ...this.loreDetailScope(),
        },
      });
      this.selectedLore.set(entry);
      this.lore.update((entries) => upsertLoreEntry(entries, entry));
      return true;
    } catch (error: unknown) {
      this.loreError.set(readErrorMessage(error));
      return false;
    } finally {
      this.loreSaving.set(false);
    }
  }

  private async promoteLoreEntryRecord(
    request: PromoteLoreEntryRequest,
  ): Promise<void> {
    this.promotingLoreEntryId.set(request.entryId);
    this.loreError.set(undefined);
    try {
      const promoted = await this.loreEntryApi.promoteEntry(request);
      this.selectedLore.set(promoted);
      this.lore.update((entries) => upsertLoreEntry(entries, promoted));
      await this.loadLoreEntries();
    } catch (error: unknown) {
      this.loreError.set(readErrorMessage(error));
    } finally {
      this.promotingLoreEntryId.set(undefined);
    }
  }

  private async annotateAutoCaptureLoreEntries(
    entries: readonly LoreEntry[],
  ): Promise<readonly LoreEntry[]> {
    const autoCaptureLayers = this.visibleLayers().filter(
      (layer) => layer.writePolicy === 'auto_capture',
    );
    if (autoCaptureLayers.length === 0 || entries.length === 0) {
      return entries;
    }
    const sourceByRecordId = new Map<string, ChatLoreLayer>();
    await Promise.all(
      autoCaptureLayers.map(async (layer) => {
        const layerEntries = await this.loreEntryApi.listLayerEntries(
          layer.layerId,
        );
        for (const entry of layerEntries) {
          sourceByRecordId.set(entry.recordId, layer);
        }
      }),
    );
    return entries.map((entry) => {
      const layer = sourceByRecordId.get(entry.recordId);
      return layer === undefined
        ? entry
        : annotateLoreEntryLayer(entry, layer.layerId, layer.writePolicy);
    });
  }

  private loreDetailScope(): {
    readonly chatId?: string;
    readonly layerIds?: readonly string[];
  } {
    const sessionId = this.chatStore.activeSessionId() ?? undefined;
    const layerIds = this.visibleLayers()
      .filter((layer) => layer.enabled)
      .map((layer) => layer.layerId);
    return {
      ...(sessionId !== undefined ? { chatId: sessionId } : {}),
      ...(layerIds.length > 0 ? { layerIds } : {}),
    };
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

function upsertSession(
  sessions: readonly RoleplaySessionSummary[],
  session: RoleplaySessionSummary,
): readonly RoleplaySessionSummary[] {
  const exists = sessions.some((item) => item.sessionId === session.sessionId);
  return exists
    ? sessions.map((item) =>
        item.sessionId === session.sessionId ? session : item,
      )
    : [session, ...sessions];
}

function upsertLoreEntry(
  entries: readonly LoreEntry[],
  entry: LoreEntry,
): readonly LoreEntry[] {
  return entries.some((item) => item.recordId === entry.recordId)
    ? entries.map((item) => (item.recordId === entry.recordId ? entry : item))
    : [entry, ...entries];
}
