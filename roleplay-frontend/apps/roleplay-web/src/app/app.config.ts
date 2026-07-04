import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideRpMessageDecorators } from '@rusty-roleplay/rp-message-decorators';
import {
  LORE_LAYER_API_CONFIG,
  LoreLayerApi,
  provideMockLoreSource,
} from '@rusty-roleplay/rp-lorebook';
import {
  CHARACTER_API_CONFIG,
  CharacterApi,
} from '@rusty-roleplay/rp-character-menu';

import { appRoutes } from './app.routes';
import {
  BACKEND_CONFIG,
  CHAT_BACKEND_PROVIDERS,
  type BackendConfig,
} from './backend-config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    ...CHAT_BACKEND_PROVIDERS,
    // Boundary proof: register RP message decoration on rusty-view's
    // CHAT_MESSAGE_DECORATORS extension token without touching the base renderer.
    ...provideRpMessageDecorators(),
    // Lore data-access boundary: mock now, HTTP-backed lorekeep client later —
    // swapped here without touching the lorebook components.
    provideMockLoreSource(),
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
  ],
};
