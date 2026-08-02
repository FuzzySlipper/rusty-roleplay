import {
  computed,
  inject,
  provideAppInitializer,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import {
  AdminStore,
  CHAT_STORAGE_ADAPTER,
  ChatStore,
  IndexedDbChatStorage,
} from '@rusty-view/chat-store';
import {
  CHAT_SETTINGS_STORAGE,
  ChatTheme,
  IndexedDbChatSettingsStorage,
  provideChatTheme,
} from '@rusty-view/chat-theme';
import { TRANSCRIPT_TEXT_RENDER_MODE } from '@rusty-view/transcript-renderer';
import { ChatTransport } from '@rusty-view/transport';

import { BACKEND_CONFIG, type BackendConfig } from './backend-config';

/** Angular providers for rusty-view's generic chat transport/store boundary. */
export const CHAT_BACKEND_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  {
    provide: ChatTransport,
    useFactory: (config: BackendConfig) =>
      new ChatTransport({
        baseUrl: config.rustyCrewBaseUrl,
        coordinationRole: config.coordinationRole,
        ...(config.bearerToken === undefined
          ? {}
          : { bearerToken: config.bearerToken }),
      }),
    deps: [BACKEND_CONFIG],
  },
  { provide: CHAT_STORAGE_ADAPTER, useClass: IndexedDbChatStorage },
  { provide: CHAT_SETTINGS_STORAGE, useClass: IndexedDbChatSettingsStorage },
  IndexedDbChatSettingsStorage,
  provideChatTheme({ themeId: 'dark' }),
  {
    provide: TRANSCRIPT_TEXT_RENDER_MODE,
    useFactory: (theme: ChatTheme) =>
      computed(() => theme.settings().textRenderMode),
    deps: [ChatTheme],
  },
  ChatStore,
  AdminStore,
  provideAppInitializer(() => {
    const store = inject(ChatStore);
    void store.refreshSessions();
    void store.loadCommands();
  }),
];
