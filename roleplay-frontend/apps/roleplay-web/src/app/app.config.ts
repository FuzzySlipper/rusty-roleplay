import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideRpMessageDecorators } from '@rusty-roleplay/rp-message-decorators';
import { provideMockLoreSource } from '@rusty-roleplay/rp-lorebook';

import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    // Boundary proof: register RP message decoration on rusty-view's
    // CHAT_MESSAGE_DECORATORS extension token without touching the base renderer.
    ...provideRpMessageDecorators(),
    // Lore data-access boundary: mock now, HTTP-backed lorekeep client later —
    // swapped here without touching the lorebook components.
    provideMockLoreSource(),
  ],
};
