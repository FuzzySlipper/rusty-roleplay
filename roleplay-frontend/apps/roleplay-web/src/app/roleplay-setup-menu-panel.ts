import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  type Type,
} from '@angular/core';
import { TabStripComponent, type TabEntry } from '@rusty-view/chat-components';

import {
  RoleplayCharactersMenuPanelComponent,
  RoleplayNarratorMenuPanelComponent,
  RoleplayPersonasMenuPanelComponent,
  RoleplayTextStyleMenuPanelComponent,
} from './roleplay-menu-panels';
import { StImportPanelComponent } from './st-import/st-import-panel';

interface RoleplaySetupTab extends TabEntry {
  readonly component: Type<unknown>;
}

export const ROLEPLAY_SETUP_TABS: readonly RoleplaySetupTab[] = [
  {
    id: 'personas',
    label: 'Personas',
    component: RoleplayPersonasMenuPanelComponent,
  },
  {
    id: 'characters',
    label: 'Characters',
    component: RoleplayCharactersMenuPanelComponent,
  },
  {
    id: 'st-import',
    label: 'ST Import',
    component: StImportPanelComponent,
  },
  {
    id: 'narrator',
    label: 'Narrator',
    component: RoleplayNarratorMenuPanelComponent,
  },
  {
    id: 'text-style',
    label: 'Text Style',
    component: RoleplayTextStyleMenuPanelComponent,
  },
];

@Component({
  selector: 'app-roleplay-setup-menu-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgComponentOutlet, TabStripComponent],
  template: `
    <rv-tab-strip
      [tabs]="tabs"
      [activeId]="activeId()"
      (selected)="selectTab($event)"
    />

    <div class="rp-setup__body">
      @if (activeComponent(); as component) {
        <ng-container [ngComponentOutlet]="component" />
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
    }

    .rp-setup__body {
      min-height: 0;
      overflow: auto;
    }
  `,
})
export class RoleplaySetupMenuPanelComponent {
  protected readonly tabs = ROLEPLAY_SETUP_TABS;
  protected readonly activeId = signal('personas');
  protected readonly activeComponent = computed(
    () =>
      ROLEPLAY_SETUP_TABS.find((tab) => tab.id === this.activeId())?.component,
  );

  protected selectTab(id: string): void {
    if (ROLEPLAY_SETUP_TABS.some((tab) => tab.id === id)) {
      this.activeId.set(id);
    }
  }
}
