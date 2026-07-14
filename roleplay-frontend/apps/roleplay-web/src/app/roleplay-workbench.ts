import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type {
  ChatMessage,
  MessageAlternateSlot,
} from '@rusty-view/chat-domain';
import { ChatStore } from '@rusty-view/chat-store';
import type { StreamStatusKind } from '@rusty-view/chat-components';
import type {
  MessageRevisionAction,
  MessageRevisionCapabilities,
} from '@rusty-view/transcript-renderer';
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
import type {
  MechanicDiagnostic,
  MechanicDiagnosticOutcomeWrite,
  MechanicProfileConfig,
  MechanicProfileConfigWrite,
  MechanicProposal,
  MechanicProposalBatchDecision,
  MechanicProposalDecision,
  MechanicSessionAttachment,
  MechanicSessionSummary,
  RpMode,
} from '@rusty-roleplay/rp-mechanic';

import { ContextApi, type ContextUsageResponse } from './context/context-api';
import { MechanicApi } from './mechanic/mechanic-api';
import { deriveNarratorPhase } from './narrator-phase';
import { NarratorConfigApi } from './narrator-config/narrator-config-api';
import type { NarratorConfig } from './narrator-config/narrator-config.model';
import { PlayerPersonaApi } from './persona-management/player-persona-api';
import type {
  PlayerPersona,
  PlayerPersonaUpdateRequest,
  PlayerPersonaWriteRequest,
} from './persona-management/player-persona.model';
import { ProfileRegistryApi } from './profile-registry/profile-registry-api';
import { RoleplayBranchingApi } from './session-management/roleplay-branching-api';
import { RoleplaySessionApi } from './session-management/roleplay-session-api';
import type {
  CreateRoleplaySessionRequest,
  RoleplaySessionSummary,
  UpdateRoleplaySessionRequest,
} from './session-management/roleplay-session.model';
import type { StPacketImportResult } from './st-import/st-packet-import-api';
import {
  applyRoleplayTextStyle,
  decorateRoleplayMessages,
  loadRoleplayTextStyle,
  saveRoleplayTextStyle,
  type RoleplayTextStyleSettings,
} from './transcript-presentation/roleplay-transcript-presentation';

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
  private readonly playerPersonaApi = inject(PlayerPersonaApi);
  private readonly profileRegistryApi = inject(ProfileRegistryApi);
  private readonly contextApi = inject(ContextApi);
  private readonly branchingApi = inject(RoleplayBranchingApi);
  private readonly mechanicApi = inject(MechanicApi);

  readonly campaignId = 'eldoria';
  readonly characters = signal<readonly RpCharacter[]>([]);
  readonly lore = signal<readonly LoreEntry[]>([]);
  readonly selectedLore = signal<LoreEntry | null>(null);
  readonly loreLoading = signal(false);
  readonly loreSaving = signal(false);
  readonly promotingLoreEntryId = signal<string | undefined>(undefined);
  readonly loreError = signal<string | undefined>(undefined);
  readonly loreQuery = signal('');
  readonly activeCharacterId = signal<string | undefined>(undefined);
  readonly activePlayerPersonaId = signal<string | undefined>(undefined);
  readonly playerPersonas = signal<readonly PlayerPersona[]>([]);
  readonly playerPersonasLoading = signal(false);
  readonly playerPersonasError = signal<string | undefined>(undefined);
  readonly mood = signal<SceneMood>('tense');
  readonly mode = signal<RpMode>('roleplay');
  readonly mechanicProfileId = signal('');
  readonly mechanicConfig = signal<MechanicProfileConfig | null>(null);
  readonly mechanicSessions = signal<readonly MechanicSessionSummary[]>([]);
  readonly mechanicProposals = signal<readonly MechanicProposal[]>([]);
  readonly mechanicDiagnostics = signal<readonly MechanicDiagnostic[]>([]);
  readonly activeMechanicSessionId = signal<string | undefined>(undefined);
  readonly mechanicLoading = signal(false);
  readonly mechanicSaving = signal(false);
  readonly mechanicError = signal<string | undefined>(undefined);
  readonly roleplaySessionBeforeMechanic = signal<string | undefined>(
    undefined,
  );
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
  readonly textStyleSettings = signal<RoleplayTextStyleSettings>(
    loadRoleplayTextStyle('default'),
  );
  readonly contextUsage = signal<ContextUsageResponse | null>(null);
  readonly contextLoading = signal(false);
  readonly contextError = signal<string | undefined>(undefined);
  readonly alternateSlots = signal<readonly MessageAlternateSlot[]>([]);
  readonly revisionLoading = signal(false);
  readonly revisionError = signal<string | undefined>(undefined);
  readonly revisionCapabilities = signal<MessageRevisionCapabilities>({
    branch: true,
    requestNextAlternative: true,
    regenerate: true,
  });
  readonly highlightedSessionId = signal<string | undefined>(undefined);
  private loreRequestId = 0;
  private lastContextRefreshKey: string | undefined;

  readonly activeProfile = this.profileStore.activeProfile;
  readonly mechanicProfileOptions = computed(() =>
    this.profileStore.profiles().map((profile) => ({
      id: profile.id,
      name: profile.name,
    })),
  );
  readonly activeRoleplaySessionId = computed(() =>
    this.mode() === 'mechanic'
      ? this.roleplaySessionBeforeMechanic()
      : (this.chatStore.activeSessionId() ?? undefined),
  );
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
  readonly activeSessionPreview = computed(() =>
    lastTranscriptPreview(this.chatStore.messages()),
  );
  readonly transcriptMessages = computed(() =>
    decorateRoleplayMessages(this.chatStore.messages()),
  );
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
    effect(() => {
      const sessionId = this.chatStore.activeSessionId();
      const latestFinishedId = latestAssistantTurnFinishedEventId(
        this.chatStore.rawEvents(),
      );

      if (sessionId === null || latestFinishedId === undefined) {
        return;
      }

      const refreshKey = `${sessionId}:${latestFinishedId}`;
      if (refreshKey !== this.lastContextRefreshKey) {
        this.lastContextRefreshKey = refreshKey;
        queueMicrotask(() => {
          void this.loadContextUsage(sessionId);
          void this.loadAlternates(sessionId);
        });
      }
    });
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

  private async sendAndRefreshContext(text: string): Promise<void> {
    try {
      await this.chatStore.sendMessage(text);
      this.refreshContextUsage();
    } catch (error: unknown) {
      this.sessionError.set(readErrorMessage(error));
    }
  }

  private async loadContextUsage(sessionId: string): Promise<void> {
    this.contextLoading.set(true);
    this.contextError.set(undefined);
    try {
      const usage = await this.contextApi.readContext(sessionId);
      if (this.chatStore.activeSessionId() === sessionId) {
        this.contextUsage.set(usage);
      }
    } catch (error: unknown) {
      if (this.chatStore.activeSessionId() === sessionId) {
        this.contextError.set(readErrorMessage(error));
      }
    } finally {
      if (this.chatStore.activeSessionId() === sessionId) {
        this.contextLoading.set(false);
      }
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
      const settings = loadRoleplayTextStyle(selection.profileId);
      this.textStyleSettings.set(settings);
      applyRoleplayTextStyle(settings);
      void this.connectToProfile(selection.profileId);
    }
  }

  send(text: string): void {
    void this.sendAndRefreshContext(text);
  }

  reconnect(): void {
    void this.chatStore.reconnect().catch((error: unknown) => {
      this.sessionError.set(readErrorMessage(error));
    });
  }

  toggleTranscriptSearch(): void {
    this.transcriptSearchEnabled.update((enabled) => !enabled);
  }

  updateTextStyle(settings: RoleplayTextStyleSettings): void {
    this.textStyleSettings.set(settings);
    applyRoleplayTextStyle(settings);
    const profileId = this.activeProfile()?.id;
    if (profileId !== undefined) {
      saveRoleplayTextStyle(profileId, settings);
    }
  }

  handleRevisionAction(action: MessageRevisionAction): void {
    void this.applyRevisionAction(action);
  }

  refreshContextUsage(): void {
    const sessionId = this.chatStore.activeSessionId();
    if (sessionId === null) {
      this.contextUsage.set(null);
      this.contextLoading.set(false);
      this.contextError.set(undefined);
      return;
    }
    void this.loadContextUsage(sessionId);
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

  activatePlayerPersona(personaId: string): void {
    this.activePlayerPersonaId.set(personaId);
    const sessionId = this.chatStore.activeSessionId();
    if (sessionId !== null) {
      void this.setSessionPlayerPersona(sessionId, personaId);
    }
  }

  createCharacter(profileId: string, request: CharacterWriteRequest): void {
    void this.createCharacterRecord(profileId, request);
  }

  createPlayerPersona(
    profileId: string,
    request: PlayerPersonaWriteRequest,
  ): void {
    void this.createPlayerPersonaRecord(profileId, request);
  }

  updatePlayerPersona(
    profileId: string,
    request: PlayerPersonaUpdateRequest,
  ): void {
    void this.updatePlayerPersonaRecord(profileId, request);
  }

  archivePlayerPersona(profileId: string, personaId: string): void {
    void this.archivePlayerPersonaRecord(profileId, personaId);
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

  setMechanicMode(mode: RpMode): void {
    if (mode === this.mode()) return;
    if (mode === 'mechanic') {
      const roleplaySessionId = this.chatStore.activeSessionId() ?? undefined;
      if (roleplaySessionId !== undefined) {
        this.roleplaySessionBeforeMechanic.set(roleplaySessionId);
      }
      this.mode.set('mechanic');
      const mechanicSessionId =
        this.activeMechanicSessionId() ??
        this.mechanicSessions().find((session) => !session.archived)
          ?.association.mechanicSessionId;
      if (mechanicSessionId !== undefined) {
        void this.selectMechanicSessionRecord(mechanicSessionId);
      }
      return;
    }
    this.mode.set('roleplay');
    const roleplaySessionId = this.roleplaySessionBeforeMechanic();
    if (roleplaySessionId !== undefined) {
      void this.restoreRoleplayChatSession(roleplaySessionId);
    }
  }

  selectMechanicProfile(profileId: string): void {
    this.mechanicProfileId.set(profileId);
    this.mechanicConfig.set(null);
    this.activeMechanicSessionId.set(undefined);
    void this.loadMechanicData();
  }

  reloadMechanicConfig(): void {
    void this.loadMechanicData();
  }

  saveMechanicConfig(config: MechanicProfileConfigWrite): void {
    void this.saveMechanicConfigRecord(config);
  }

  refreshMechanicData(): void {
    void this.loadMechanicData();
  }

  createMechanicSession(): void {
    void this.createMechanicSessionRecord();
  }

  selectMechanicSession(sessionId: string): void {
    void this.selectMechanicSessionRecord(sessionId);
  }

  attachMechanicSession(request: MechanicSessionAttachment): void {
    void this.attachMechanicSessionRecord(request);
  }

  archiveMechanicSession(sessionId: string): void {
    void this.archiveMechanicSessionRecord(sessionId);
  }

  restoreMechanicSession(sessionId: string): void {
    void this.restoreMechanicSessionRecord(sessionId);
  }

  approveMechanicProposal(decision: MechanicProposalDecision): void {
    void this.decideMechanicProposal('approve', decision);
  }

  rejectMechanicProposal(decision: MechanicProposalDecision): void {
    void this.decideMechanicProposal('reject', decision);
  }

  approveMechanicProposalBatch(decision: MechanicProposalBatchDecision): void {
    void this.decideMechanicProposalBatch('approve', decision);
  }

  rejectMechanicProposalBatch(decision: MechanicProposalBatchDecision): void {
    void this.decideMechanicProposalBatch('reject', decision);
  }

  applyMechanicProposal(proposalId: string): void {
    void this.applyMechanicProposalRecord(proposalId);
  }

  saveMechanicDiagnosticOutcome(request: MechanicDiagnosticOutcomeWrite): void {
    void this.saveMechanicDiagnosticOutcomeRecord(request);
  }

  async refreshAfterStImport(result: StPacketImportResult): Promise<void> {
    await Promise.all([
      this.loadRoleplaySessions(result.profileId),
      this.loadPlayerPersonas(result.profileId),
      this.loadCharacters(result.profileId),
      this.loadProfileLayers(result.profileId),
      this.chatStore.refreshSessions(),
    ]);
    if (result.sessionId !== undefined) {
      await this.selectRoleplaySession(result.profileId, result.sessionId);
      this.highlightCreatedSession(result.sessionId);
      return;
    }
    await this.loadLoreEntries();
  }

  private async connectToProfile(profileId: string): Promise<void> {
    this.sessionError.set(undefined);
    if (this.mechanicProfileId() === '') {
      this.mechanicProfileId.set(profileId);
    }
    try {
      const [roleplaySessions] = await Promise.all([
        this.loadRoleplaySessions(profileId),
        this.loadPlayerPersonas(profileId),
        this.loadCharacters(profileId),
        this.loadProfileLayers(profileId),
        this.loadNarratorConfig(profileId),
        this.loadMechanicData(),
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
      this.roleplaySessionBeforeMechanic.set(selected.session_id);
      this.syncActiveCharacterFromSession(selected.session_id);
      this.syncActivePlayerPersonaFromSession(selected.session_id);
      await this.loadChatLayers(selected.session_id);
      await this.loadAlternates(selected.session_id);
      await this.loadLoreEntries();
      await this.loadContextUsage(selected.session_id);
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
      this.mode.set('roleplay');
      await this.chatStore.refreshSessions();
      await this.chatStore.selectSession(sessionId);
      this.roleplaySessionBeforeMechanic.set(sessionId);
      this.syncActiveCharacterFromSession(sessionId);
      this.syncActivePlayerPersonaFromSession(sessionId);
      await this.loadChatLayers(sessionId);
      await this.loadAlternates(sessionId);
      await this.loadLoreEntries();
      await this.loadContextUsage(sessionId);
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
      this.activePlayerPersonaId.set(session.playerPersonaId);
      this.highlightCreatedSession(session.sessionId);
      await this.loadChatLayers(session.sessionId);
      await this.loadAlternates(session.sessionId);
      await this.loadLoreEntries();
      await this.loadContextUsage(session.sessionId);
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

  private async loadAlternates(sessionId: string): Promise<void> {
    this.revisionError.set(undefined);
    try {
      const slot = await this.branchingApi.readTerminalAlternatives(sessionId);
      this.alternateSlots.set(slot === null ? [] : [slot]);
    } catch {
      this.alternateSlots.set([]);
    }
  }

  private async applyRevisionAction(
    action: MessageRevisionAction,
  ): Promise<void> {
    const sessionId = this.chatStore.activeSessionId();
    if (sessionId === null) {
      return;
    }
    this.revisionError.set(undefined);
    this.revisionLoading.set(true);
    try {
      switch (action.kind) {
        case 'previous_variant':
        case 'next_variant':
        case 'select_variant': {
          if (action.slot === undefined) {
            return;
          }
          await this.branchingApi.selectAlternative(
            sessionId,
            action.slot.id,
            action.variant?.id,
          );
          await this.chatStore.selectSession(sessionId);
          await this.loadAlternates(sessionId);
          return;
        }
        case 'branch': {
          const fork = await this.branchingApi.forkSession(
            sessionId,
            action.message.id,
            `Fork from ${this.sceneLabel()}`,
          );
          this.roleplaySessions.update((sessions) =>
            upsertSession(sessions, fork),
          );
          await this.chatStore.refreshSessions();
          await this.selectRoleplaySession(fork.profileId, fork.sessionId);
          return;
        }
        case 'request_next_alternative':
        case 'regenerate': {
          if (action.slot === undefined) {
            this.revisionError.set(
              'Assistant alternatives are available for the latest assistant message.',
            );
            return;
          }
          await this.branchingApi.generateAlternative(
            sessionId,
            action.slot.id,
            undefined,
          );
          await this.chatStore.selectSession(sessionId);
          await this.loadAlternates(sessionId);
          return;
        }
        default:
          return;
      }
    } catch (error: unknown) {
      this.revisionError.set(readErrorMessage(error));
    } finally {
      this.revisionLoading.set(false);
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

  private async loadPlayerPersonas(profileId: string): Promise<void> {
    this.playerPersonasLoading.set(true);
    this.playerPersonasError.set(undefined);
    try {
      const personas = await this.playerPersonaApi.listPersonas(profileId);
      this.playerPersonas.set(personas);
      const activeId = this.activePlayerPersonaId();
      if (
        activeId !== undefined &&
        !personas.some((persona) => persona.id === activeId)
      ) {
        this.activePlayerPersonaId.set(undefined);
      }
    } catch (error: unknown) {
      this.playerPersonasError.set(readErrorMessage(error));
    } finally {
      this.playerPersonasLoading.set(false);
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

  private async loadMechanicData(): Promise<void> {
    const mechanicProfileId = this.mechanicProfileId();
    if (mechanicProfileId === '') {
      this.mechanicConfig.set(null);
      this.mechanicSessions.set([]);
      this.mechanicProposals.set([]);
      this.mechanicDiagnostics.set([]);
      return;
    }
    this.mechanicLoading.set(true);
    this.mechanicError.set(undefined);
    const roleplaySessionId = this.activeRoleplaySessionId();
    const roleplayProfileId = this.activeProfile()?.id;
    try {
      const [config, sessions, proposals, diagnostics] = await Promise.all([
        this.mechanicApi.readProfileConfig(mechanicProfileId),
        this.mechanicApi.listSessions({ mechanicProfileId }),
        this.mechanicApi.listProposals({
          ...(roleplaySessionId !== undefined ? { roleplaySessionId } : {}),
          ...(roleplaySessionId === undefined && roleplayProfileId !== undefined
            ? { profileId: roleplayProfileId }
            : {}),
        }),
        this.mechanicApi.listDiagnostics({
          ...(roleplaySessionId !== undefined ? { roleplaySessionId } : {}),
          ...(roleplaySessionId === undefined && roleplayProfileId !== undefined
            ? { roleplayProfileId }
            : {}),
        }),
      ]);
      this.mechanicConfig.set(config);
      this.mechanicSessions.set(sessions);
      this.mechanicProposals.set(proposals);
      this.mechanicDiagnostics.set(diagnostics);
      const selected = this.activeMechanicSessionId();
      if (
        selected === undefined ||
        sessions.every(
          (session) => session.association.mechanicSessionId !== selected,
        )
      ) {
        this.activeMechanicSessionId.set(
          sessions.find((session) => !session.archived)?.association
            .mechanicSessionId,
        );
      }
    } catch (error: unknown) {
      this.mechanicError.set(readErrorMessage(error));
    } finally {
      this.mechanicLoading.set(false);
    }
  }

  private async saveMechanicConfigRecord(
    config: MechanicProfileConfigWrite,
  ): Promise<void> {
    const profileId = this.mechanicProfileId();
    if (profileId === '') return;
    this.mechanicSaving.set(true);
    this.mechanicError.set(undefined);
    try {
      this.mechanicConfig.set(
        await this.mechanicApi.saveProfileConfig(profileId, config),
      );
      this.mechanicSessions.set(
        await this.mechanicApi.listSessions({ mechanicProfileId: profileId }),
      );
    } catch (error: unknown) {
      this.mechanicError.set(readErrorMessage(error));
    } finally {
      this.mechanicSaving.set(false);
    }
  }

  private async createMechanicSessionRecord(): Promise<void> {
    const profileId = this.mechanicProfileId();
    if (profileId === '') {
      this.mechanicError.set('Select a configured mechanic profile first.');
      return;
    }
    this.mechanicSaving.set(true);
    this.mechanicError.set(undefined);
    try {
      const session = await this.mechanicApi.createSession(
        profileId,
        this.activeRoleplaySessionId(),
      );
      this.mechanicSessions.update((sessions) =>
        upsertMechanicSession(sessions, session),
      );
      await this.selectMechanicSessionRecord(
        session.association.mechanicSessionId,
      );
    } catch (error: unknown) {
      this.mechanicError.set(readErrorMessage(error));
    } finally {
      this.mechanicSaving.set(false);
    }
  }

  private async selectMechanicSessionRecord(sessionId: string): Promise<void> {
    this.mechanicError.set(undefined);
    try {
      if (this.mode() !== 'mechanic') {
        const roleplaySessionId = this.chatStore.activeSessionId() ?? undefined;
        if (roleplaySessionId !== undefined) {
          this.roleplaySessionBeforeMechanic.set(roleplaySessionId);
        }
      }
      await this.chatStore.refreshSessions();
      await this.chatStore.selectSession(sessionId);
      this.activeMechanicSessionId.set(sessionId);
      this.mode.set('mechanic');
      await this.loadMechanicData();
    } catch (error: unknown) {
      this.mechanicError.set(readErrorMessage(error));
    }
  }

  private async restoreRoleplayChatSession(sessionId: string): Promise<void> {
    const profileId = this.activeProfile()?.id;
    if (profileId === undefined) return;
    await this.selectRoleplaySession(profileId, sessionId);
  }

  private async attachMechanicSessionRecord(
    request: MechanicSessionAttachment,
  ): Promise<void> {
    this.mechanicSaving.set(true);
    this.mechanicError.set(undefined);
    try {
      const association = await this.mechanicApi.attachSession(request);
      this.mechanicSessions.update((sessions) =>
        sessions.map((session) =>
          session.association.mechanicSessionId ===
          association.mechanicSessionId
            ? { ...session, association }
            : session,
        ),
      );
      await this.loadMechanicData();
    } catch (error: unknown) {
      this.mechanicError.set(readErrorMessage(error));
    } finally {
      this.mechanicSaving.set(false);
    }
  }

  private async archiveMechanicSessionRecord(sessionId: string): Promise<void> {
    await this.mutateMechanicSession(sessionId, 'archive');
  }

  private async restoreMechanicSessionRecord(sessionId: string): Promise<void> {
    await this.mutateMechanicSession(sessionId, 'restore');
  }

  private async mutateMechanicSession(
    sessionId: string,
    action: 'archive' | 'restore',
  ): Promise<void> {
    this.mechanicSaving.set(true);
    this.mechanicError.set(undefined);
    try {
      if (action === 'archive') {
        await this.mechanicApi.archiveSession(sessionId);
      } else {
        await this.mechanicApi.restoreSession(sessionId);
      }
      await this.loadMechanicData();
      if (
        action === 'archive' &&
        this.activeMechanicSessionId() === sessionId
      ) {
        this.activeMechanicSessionId.set(
          this.mechanicSessions().find((session) => !session.archived)
            ?.association.mechanicSessionId,
        );
      }
    } catch (error: unknown) {
      this.mechanicError.set(readErrorMessage(error));
    } finally {
      this.mechanicSaving.set(false);
    }
  }

  private async decideMechanicProposal(
    action: 'approve' | 'reject',
    decision: MechanicProposalDecision,
  ): Promise<void> {
    this.mechanicSaving.set(true);
    this.mechanicError.set(undefined);
    try {
      const proposal =
        action === 'approve'
          ? await this.mechanicApi.approveProposal(decision)
          : await this.mechanicApi.rejectProposal(decision);
      this.mechanicProposals.update((proposals) =>
        upsertMechanicProposal(proposals, proposal),
      );
    } catch (error: unknown) {
      this.mechanicError.set(readErrorMessage(error));
    } finally {
      this.mechanicSaving.set(false);
    }
  }

  private async decideMechanicProposalBatch(
    action: 'approve' | 'reject',
    batch: MechanicProposalBatchDecision,
  ): Promise<void> {
    this.mechanicSaving.set(true);
    this.mechanicError.set(undefined);
    try {
      for (const proposalId of batch.proposalIds) {
        const proposal = this.mechanicProposals().find(
          (candidate) => candidate.proposalId === proposalId,
        );
        if (proposal === undefined || proposal.status !== 'proposed') continue;
        const decision: MechanicProposalDecision = {
          proposalId,
          reviewerId: batch.reviewerId,
          expectedRevision: proposal.revision,
          ...(batch.note !== undefined ? { note: batch.note } : {}),
        };
        const decided =
          action === 'approve'
            ? await this.mechanicApi.approveProposal(decision)
            : await this.mechanicApi.rejectProposal(decision);
        this.mechanicProposals.update((proposals) =>
          upsertMechanicProposal(proposals, decided),
        );
      }
    } catch (error: unknown) {
      this.mechanicError.set(readErrorMessage(error));
      await this.loadMechanicData();
    } finally {
      this.mechanicSaving.set(false);
    }
  }

  private async applyMechanicProposalRecord(proposalId: string): Promise<void> {
    this.mechanicSaving.set(true);
    this.mechanicError.set(undefined);
    try {
      const proposal = await this.mechanicApi.applyProposal(
        proposalId,
        'roleplay-user',
      );
      this.mechanicProposals.update((proposals) =>
        upsertMechanicProposal(proposals, proposal),
      );
      await Promise.all([
        this.loadNarratorConfig(proposal.profileId),
        this.loadLoreEntries(),
      ]);
    } catch (error: unknown) {
      this.mechanicError.set(readErrorMessage(error));
    } finally {
      this.mechanicSaving.set(false);
    }
  }

  private async saveMechanicDiagnosticOutcomeRecord(
    request: MechanicDiagnosticOutcomeWrite,
  ): Promise<void> {
    this.mechanicSaving.set(true);
    this.mechanicError.set(undefined);
    try {
      const diagnostic =
        await this.mechanicApi.updateDiagnosticOutcome(request);
      this.mechanicDiagnostics.update((diagnostics) =>
        upsertMechanicDiagnostic(diagnostics, diagnostic),
      );
    } catch (error: unknown) {
      this.mechanicError.set(readErrorMessage(error));
    } finally {
      this.mechanicSaving.set(false);
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

  private async createPlayerPersonaRecord(
    profileId: string,
    request: PlayerPersonaWriteRequest,
  ): Promise<void> {
    this.playerPersonasError.set(undefined);
    try {
      const persona = await this.playerPersonaApi.createPersona(
        profileId,
        request,
      );
      this.playerPersonas.update((personas) => [...personas, persona]);
      this.activePlayerPersonaId.set(persona.id);
      const sessionId = this.chatStore.activeSessionId();
      if (sessionId !== null) {
        await this.setSessionPlayerPersona(sessionId, persona.id);
      }
    } catch (error: unknown) {
      this.playerPersonasError.set(readErrorMessage(error));
    }
  }

  private async updatePlayerPersonaRecord(
    profileId: string,
    request: PlayerPersonaUpdateRequest,
  ): Promise<void> {
    this.playerPersonasError.set(undefined);
    try {
      const persona = await this.playerPersonaApi.updatePersona(
        profileId,
        request,
      );
      this.playerPersonas.update((personas) =>
        personas.map((item) => (item.id === persona.id ? persona : item)),
      );
    } catch (error: unknown) {
      this.playerPersonasError.set(readErrorMessage(error));
    }
  }

  private async archivePlayerPersonaRecord(
    profileId: string,
    personaId: string,
  ): Promise<void> {
    this.playerPersonasError.set(undefined);
    try {
      await this.playerPersonaApi.archivePersona(profileId, personaId);
      this.playerPersonas.update((personas) =>
        personas.filter((persona) => persona.id !== personaId),
      );
      if (this.activePlayerPersonaId() === personaId) {
        this.activePlayerPersonaId.set(undefined);
      }
    } catch (error: unknown) {
      this.playerPersonasError.set(readErrorMessage(error));
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

  private async setSessionPlayerPersona(
    sessionId: string,
    playerPersonaId: string,
  ): Promise<void> {
    this.playerPersonasError.set(undefined);
    try {
      const session = await this.roleplaySessionApi.updateSession({
        sessionId,
        playerPersonaId,
      });
      this.roleplaySessions.update((sessions) =>
        upsertSession(sessions, session),
      );
    } catch (error: unknown) {
      this.playerPersonasError.set(readErrorMessage(error));
    }
  }

  private syncActiveCharacterFromSession(sessionId: string): void {
    const session = this.roleplaySessions().find(
      (candidate) => candidate.sessionId === sessionId,
    );
    this.activeCharacterId.set(session?.characterId);
  }

  private syncActivePlayerPersonaFromSession(sessionId: string): void {
    const session = this.roleplaySessions().find(
      (candidate) => candidate.sessionId === sessionId,
    );
    this.activePlayerPersonaId.set(session?.playerPersonaId);
  }

  private highlightCreatedSession(sessionId: string): void {
    this.highlightedSessionId.set(sessionId);
    window.setTimeout(() => {
      if (this.highlightedSessionId() === sessionId) {
        this.highlightedSessionId.set(undefined);
      }
    }, 2400);
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

function latestAssistantTurnFinishedEventId(
  events: readonly {
    readonly kind?: string;
    readonly event_id?: string;
    readonly eventId?: string;
  }[],
): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.kind === 'assistant_turn_finished') {
      return event.event_id ?? event.eventId ?? String(index);
    }
  }
  return undefined;
}

function lastTranscriptPreview(
  messages: readonly ChatMessage[],
): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const content = message?.blocks
      .map((block) => block.content.trim())
      .filter((block) => block.length > 0)
      .join(' ')
      .trim();
    if (content !== undefined && content.length > 0) {
      return content.length > 160 ? `${content.slice(0, 157)}...` : content;
    }
  }
  return undefined;
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

function upsertMechanicSession(
  sessions: readonly MechanicSessionSummary[],
  session: MechanicSessionSummary,
): readonly MechanicSessionSummary[] {
  const id = session.association.mechanicSessionId;
  return sessions.some((item) => item.association.mechanicSessionId === id)
    ? sessions.map((item) =>
        item.association.mechanicSessionId === id ? session : item,
      )
    : [session, ...sessions];
}

function upsertMechanicProposal(
  proposals: readonly MechanicProposal[],
  proposal: MechanicProposal,
): readonly MechanicProposal[] {
  return proposals.some((item) => item.proposalId === proposal.proposalId)
    ? proposals.map((item) =>
        item.proposalId === proposal.proposalId ? proposal : item,
      )
    : [proposal, ...proposals];
}

function upsertMechanicDiagnostic(
  diagnostics: readonly MechanicDiagnostic[],
  diagnostic: MechanicDiagnostic,
): readonly MechanicDiagnostic[] {
  return diagnostics.some(
    (item) => item.diagnosticId === diagnostic.diagnosticId,
  )
    ? diagnostics.map((item) =>
        item.diagnosticId === diagnostic.diagnosticId ? diagnostic : item,
      )
    : [diagnostic, ...diagnostics];
}

function upsertLoreEntry(
  entries: readonly LoreEntry[],
  entry: LoreEntry,
): readonly LoreEntry[] {
  return entries.some((item) => item.recordId === entry.recordId)
    ? entries.map((item) => (item.recordId === entry.recordId ? entry : item))
    : [entry, ...entries];
}
