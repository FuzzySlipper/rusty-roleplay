import { Provider } from '@angular/core';
import { CHAT_MESSAGE_DECORATORS } from '@rusty-view/transcript-renderer';

import { NarratorCharacterDecorator } from './rp-message-decorators';

/**
 * Provider helper the app wires into its bootstrap. Registers the RP decorators
 * on the multi-provider token rusty-view's transcript renderer reads.
 */
export function provideRpMessageDecorators(): Provider[] {
  return [
    {
      provide: CHAT_MESSAGE_DECORATORS,
      multi: true,
      useValue: new NarratorCharacterDecorator(),
    },
  ];
}
