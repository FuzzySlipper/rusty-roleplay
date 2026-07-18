import { AdminServicePanelComponent } from '@rusty-view/chat-shell';
import { describe, expect, it } from 'vitest';

import { PromptStackPanelComponent } from './prompt-stack/prompt-stack-panel';

import {
  ROLEPLAY_DEBUG_TABS,
  ROLEPLAY_TOP_MENU_CONFIGURATION,
  ROLEPLAY_TOP_MENU_ITEM_TOOLTIPS,
  ROLEPLAY_TOP_MENU_PANELS,
} from './app.config';

describe('roleplay top-menu configuration', () => {
  it('keeps RP Sessions while hiding the generic Sessions and Service entries', () => {
    expect(ROLEPLAY_TOP_MENU_CONFIGURATION.hiddenBuiltInItemIds).toEqual([
      'sessions',
      'service',
    ]);

    const roleplayPanelLabels = ROLEPLAY_TOP_MENU_PANELS.map(
      (panel) => panel.label,
    );
    const roleplayItemLabels = ROLEPLAY_TOP_MENU_ITEM_TOOLTIPS.map(
      (item) => item.label,
    );

    expect(roleplayPanelLabels).toContain('RP Sessions');
    expect(roleplayItemLabels).toContain('RP Sessions');
    expect(roleplayItemLabels).not.toContain('Sessions');
    expect(roleplayItemLabels).not.toContain('Service');
    expect(roleplayItemLabels).not.toContain('Prompt');
    expect(roleplayPanelLabels).not.toContain('Prompt');
  });

  it('contributes Service and Prompt through the built-in Debug surface', () => {
    expect(ROLEPLAY_DEBUG_TABS).toEqual([
      {
        id: 'service',
        label: 'Service',
        order: 40,
        mode: 'controls',
        component: AdminServicePanelComponent,
      },
      {
        id: 'prompt-stack',
        label: 'Prompt',
        order: 50,
        mode: 'diagnostics',
        component: PromptStackPanelComponent,
      },
    ]);
  });
});
