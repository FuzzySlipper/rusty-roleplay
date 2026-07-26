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
import { ImageGenerationPanelComponent } from './image-generation/image-generation-panel';
import { StImportPanelComponent } from './st-import/st-import-panel';

interface RoleplaySetupTab extends TabEntry {
  readonly component?: Type<unknown>;
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
    id: 'images',
    label: 'Images',
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
  imports: [
    ImageGenerationPanelComponent,
    NgComponentOutlet,
    TabStripComponent,
  ],
  template: `
    <rv-tab-strip
      [tabs]="tabs"
      [activeId]="activeId()"
      (selected)="selectTab($event)"
    />

    <div class="rp-setup__body">
      @if (activeId() === 'images') {
        @defer {
          <app-image-generation-panel />
        } @placeholder {
          <p class="rp-setup__state">Loading image controls…</p>
        }
      } @else if (activeComponent(); as component) {
        <ng-container [ngComponentOutlet]="component" />
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      max-height: calc(80vh - 2.5rem);
      min-height: 0;
      flex-direction: column;
      overflow: hidden;
    }

    .rp-setup__body {
      min-height: 0;
      overflow: auto;
    }

    .rp-setup__state {
      margin: var(--rv-space-md, 8px);
      color: var(--rv-color-text-muted, #7a828d);
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
