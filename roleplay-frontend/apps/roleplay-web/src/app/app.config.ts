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
import { MechanicApi } from './mechanic/mechanic-api';
import { NarratorConfigApi } from './narrator-config/narrator-config-api';
import { PlayerPersonaApi } from './persona-management/player-persona-api';
import { PromptStackApi } from './prompt-stack/prompt-stack-api';
import { PromptStackPanelComponent } from './prompt-stack/prompt-stack-panel';
import { ProfileRegistryApi } from './profile-registry/profile-registry-api';
import {
  RoleplayLoreMenuPanelComponent,
  RoleplayMechanicsMenuPanelComponent,
  RoleplaySessionsMenuPanelComponent,
} from './roleplay-menu-panels';
import { RoleplaySetupMenuPanelComponent } from './roleplay-setup-menu-panel';
import { RoleplayWorkbench } from './roleplay-workbench';
import { RoleplayBranchingApi } from './session-management/roleplay-branching-api';
import { RoleplaySessionApi } from './session-management/roleplay-session-api';
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
    id: 'rp-setup',
    label: 'RP Setup',
    title: 'RP Setup',
    order: 12,
    width: 'wide',
    component: RoleplaySetupMenuPanelComponent,
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
    id: 'rp-prompt-stack',
    label: 'Prompt',
    title: 'Prompt Stack',
    order: 17,
    width: 'wide',
    component: PromptStackPanelComponent,
  },
  {
    id: 'rp-mechanics',
    label: 'Mechanic',
    title: 'Mechanic / OOC Workspace',
    order: 19,
    width: 'wide',
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
    id: 'rp-setup',
    label: 'RP Setup',
    tooltip:
      'Manage personas, characters, ST imports, narrator settings, and text styles',
    kind: 'panel',
    panelId: 'rp-setup',
    order: 12,
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
    id: 'rp-prompt-stack',
    label: 'Prompt',
    tooltip: 'Inspect the compiled prompt sections and source trace',
    kind: 'panel',
    panelId: 'rp-prompt-stack',
    order: 17,
  },
  {
    id: 'rp-mechanics',
    label: 'Mechanic',
    tooltip:
      'Switch to separate OOC chat, review proposed fixes, and track outcomes',
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
    MechanicApi,
    RoleplaySessionApi,
    StPacketImportApi,
  ],
};
