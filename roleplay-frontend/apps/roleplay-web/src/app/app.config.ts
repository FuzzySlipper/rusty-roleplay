import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  CHAT_TOP_MENU_ITEMS,
  CHAT_TOP_MENU_PANELS,
  type ChatTopMenuItem,
  type ChatTopMenuPanel,
} from '@rusty-view/chat-shell';
import { provideRpMessageDecorators } from '@rusty-roleplay/rp-message-decorators';
import {
  LORE_ENTRY_API_CONFIG,
  LORE_LAYER_API_CONFIG,
  LORE_SOURCE,
  LoreEntryApi,
  LoreLayerApi,
} from '@rusty-roleplay/rp-lorebook';
import {
  CHARACTER_API_CONFIG,
  CharacterApi,
} from '@rusty-roleplay/rp-character-menu';

import { appRoutes } from './app.routes';
import { BACKEND_CONFIG, type BackendConfig } from './backend-config';
import { CHAT_BACKEND_PROVIDERS } from './chat-backend-providers';
import { ContextApi } from './context/context-api';
import { NarratorConfigApi } from './narrator-config/narrator-config-api';
import { PlayerPersonaApi } from './persona-management/player-persona-api';
import { PromptStackApi } from './prompt-stack/prompt-stack-api';
import { PromptStackPanelComponent } from './prompt-stack/prompt-stack-panel';
import { ProfileRegistryApi } from './profile-registry/profile-registry-api';
import {
  RoleplayCharactersMenuPanelComponent,
  RoleplayLoreMenuPanelComponent,
  RoleplayMechanicsMenuPanelComponent,
  RoleplayNarratorMenuPanelComponent,
  RoleplayPersonasMenuPanelComponent,
  RoleplaySessionsMenuPanelComponent,
  RoleplayTextStyleMenuPanelComponent,
} from './roleplay-menu-panels';
import { RoleplayWorkbench } from './roleplay-workbench';
import { RoleplayBranchingApi } from './session-management/roleplay-branching-api';
import { RoleplaySessionApi } from './session-management/roleplay-session-api';
import { StImportPanelComponent } from './st-import/st-import-panel';
import { StPacketImportApi } from './st-import/st-packet-import-api';

const ROLEPLAY_TOP_MENU_PANELS: readonly ChatTopMenuPanel[] = [
  {
    id: 'rp-sessions',
    label: 'RP Sessions',
    title: 'Roleplay Sessions',
    order: 11,
    width: 'wide',
    component: RoleplaySessionsMenuPanelComponent,
  },
  {
    id: 'rp-personas',
    label: 'Personas',
    title: 'Player Personas',
    order: 12,
    width: 'wide',
    component: RoleplayPersonasMenuPanelComponent,
  },
  {
    id: 'rp-characters',
    label: 'Characters',
    title: 'Characters',
    order: 13,
    width: 'wide',
    component: RoleplayCharactersMenuPanelComponent,
  },
  {
    id: 'rp-text-style',
    label: 'Text Style',
    title: 'Roleplay Text Style',
    order: 14,
    component: RoleplayTextStyleMenuPanelComponent,
  },
  {
    id: 'rp-lore',
    label: 'Lore',
    title: 'Lore',
    order: 15,
    width: 'wide',
    component: RoleplayLoreMenuPanelComponent,
  },
  {
    id: 'rp-st-import',
    label: 'ST Import',
    title: 'SillyTavern Import',
    order: 16,
    width: 'wide',
    component: StImportPanelComponent,
  },
  {
    id: 'rp-prompt-stack',
    label: 'Prompt',
    title: 'Prompt Stack',
    order: 17,
    width: 'wide',
    component: PromptStackPanelComponent,
  },
  {
    id: 'rp-narrator',
    label: 'Narrator',
    title: 'Narrator Config',
    order: 18,
    component: RoleplayNarratorMenuPanelComponent,
  },
  {
    id: 'rp-mechanics',
    label: 'Mechanics',
    title: 'Scene Mechanics',
    order: 19,
    component: RoleplayMechanicsMenuPanelComponent,
  },
];

const ROLEPLAY_TOP_MENU_ITEM_TOOLTIPS: readonly Omit<
  ChatTopMenuItem,
  'onActivate'
>[] = [
  {
    id: 'rp-sessions',
    label: 'RP Sessions',
    tooltip: 'Create, rename, archive, and switch roleplay sessions',
    kind: 'panel',
    panelId: 'rp-sessions',
    order: 11,
  },
  {
    id: 'rp-personas',
    label: 'Personas',
    tooltip: 'Manage player-side identities and bind one to the session',
    kind: 'panel',
    panelId: 'rp-personas',
    order: 12,
  },
  {
    id: 'rp-characters',
    label: 'Characters',
    tooltip: 'Manage scene characters and activate one for the current session',
    kind: 'panel',
    panelId: 'rp-characters',
    order: 13,
  },
  {
    id: 'rp-text-style',
    label: 'Text Style',
    tooltip: 'Tune dialogue, narration, emphasis, and OOC transcript colors',
    kind: 'panel',
    panelId: 'rp-text-style',
    order: 14,
  },
  {
    id: 'rp-lore',
    label: 'Lore',
    tooltip: 'Browse lore entries and choose active lore layers',
    kind: 'panel',
    panelId: 'rp-lore',
    order: 15,
  },
  {
    id: 'rp-st-import',
    label: 'ST Import',
    tooltip:
      'Import ST characters, personas, lorebooks, transcripts, and swipes without replaying legacy prompt ceremony',
    kind: 'panel',
    panelId: 'rp-st-import',
    order: 16,
  },
  {
    id: 'rp-prompt-stack',
    label: 'Prompt',
    tooltip: 'Inspect the compiled prompt sections and source trace',
    kind: 'panel',
    panelId: 'rp-prompt-stack',
    order: 17,
  },
  {
    id: 'rp-narrator',
    label: 'Narrator',
    tooltip: 'Tune the editable narrator style prompt and review pass',
    kind: 'panel',
    panelId: 'rp-narrator',
    order: 18,
  },
  {
    id: 'rp-mechanics',
    label: 'Mechanics',
    tooltip: 'Open out-of-character diagnostics and proposed fixes',
    kind: 'panel',
    panelId: 'rp-mechanics',
    order: 19,
  },
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => {
      document.documentElement.setAttribute('data-rv-theme', 'dark');
    }),
    provideRouter(appRoutes),
    ...CHAT_BACKEND_PROVIDERS,
    RoleplayWorkbench,
    {
      provide: CHAT_TOP_MENU_PANELS,
      useValue: ROLEPLAY_TOP_MENU_PANELS,
    },
    {
      provide: CHAT_TOP_MENU_ITEMS,
      useFactory: (
        workbench: RoleplayWorkbench,
      ): readonly ChatTopMenuItem[] => [
        {
          id: 'rp-search',
          label: 'Search',
          tooltip: 'Toggle transcript search in the current session',
          kind: 'action',
          order: 5,
          onActivate: () => workbench.toggleTranscriptSearch(),
        },
        ...ROLEPLAY_TOP_MENU_ITEM_TOOLTIPS,
      ],
      deps: [RoleplayWorkbench],
    },
    // Boundary proof: register RP message decoration on rusty-view's
    // CHAT_MESSAGE_DECORATORS extension token without touching the base renderer.
    ...provideRpMessageDecorators(),
    {
      provide: LORE_ENTRY_API_CONFIG,
      useFactory: (config: BackendConfig) => ({
        baseUrl: config.rustyCrewBaseUrl,
        bearerToken: config.bearerToken,
      }),
      deps: [BACKEND_CONFIG],
    },
    LoreEntryApi,
    { provide: LORE_SOURCE, useExisting: LoreEntryApi },
    {
      provide: LORE_LAYER_API_CONFIG,
      useFactory: (config: BackendConfig) => ({
        baseUrl: config.rustyCrewBaseUrl,
        bearerToken: config.bearerToken,
      }),
      deps: [BACKEND_CONFIG],
    },
    LoreLayerApi,
    {
      provide: CHARACTER_API_CONFIG,
      useFactory: (config: BackendConfig) => ({
        baseUrl: config.rustyCrewBaseUrl,
        bearerToken: config.bearerToken,
      }),
      deps: [BACKEND_CONFIG],
    },
    CharacterApi,
    ContextApi,
    NarratorConfigApi,
    PlayerPersonaApi,
    PromptStackApi,
    ProfileRegistryApi,
    RoleplayBranchingApi,
    RoleplaySessionApi,
    StPacketImportApi,
  ],
};
