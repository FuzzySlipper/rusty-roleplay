import type { Signal, Type, WritableSignal } from '@angular/core';
import { describe, expect, it } from 'vitest';

import {
  ROLEPLAY_SETUP_TABS,
  RoleplaySetupMenuPanelComponent,
} from './roleplay-setup-menu-panel';

interface SetupPanelTestSurface {
  readonly activeId: WritableSignal<string>;
  readonly activeComponent: Signal<Type<unknown> | undefined>;
  selectTab(id: string): void;
}

describe('RoleplaySetupMenuPanelComponent', () => {
  it('exposes the requested setup tabs in top-bar replacement order', () => {
    expect(ROLEPLAY_SETUP_TABS.map(({ id, label }) => ({ id, label }))).toEqual(
      [
        { id: 'personas', label: 'Personas' },
        { id: 'characters', label: 'Characters' },
        { id: 'st-import', label: 'ST Import' },
        { id: 'narrator', label: 'Narrator' },
        { id: 'images', label: 'Images' },
        { id: 'text-style', label: 'Text Style' },
      ],
    );
  });

  it('starts on Personas and switches the rendered component by tab id', () => {
    const panel =
      new RoleplaySetupMenuPanelComponent() as unknown as SetupPanelTestSurface;

    expect(panel.activeId()).toBe('personas');
    expect(panel.activeComponent()).toBe(
      ROLEPLAY_SETUP_TABS.find((tab) => tab.id === 'personas')?.component,
    );

    panel.selectTab('narrator');

    expect(panel.activeId()).toBe('narrator');
    expect(panel.activeComponent()).toBe(
      ROLEPLAY_SETUP_TABS.find((tab) => tab.id === 'narrator')?.component,
    );
  });

  it('ignores unknown tab ids', () => {
    const panel =
      new RoleplaySetupMenuPanelComponent() as unknown as SetupPanelTestSurface;

    panel.selectTab('unknown');

    expect(panel.activeId()).toBe('personas');
  });
});
