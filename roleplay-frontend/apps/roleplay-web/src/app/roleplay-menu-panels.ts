import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { TooltipDirective } from '@rusty-view/chat-components';
import { RpCharacterManagerComponent } from '@rusty-roleplay/rp-character-menu';
import {
  LoreEntryEditorComponent,
  type LoreEntryEditRequest,
  LoreLayerPanelComponent,
  RpLorebookPanelComponent,
} from '@rusty-roleplay/rp-lorebook';
import { RpMechanicPanelComponent } from '@rusty-roleplay/rp-mechanic';
import { RpSceneControlsComponent } from '@rusty-roleplay/rp-scene-controls';

import { ContextBreakdownComponent } from './context/context-breakdown';
import { NarratorConfigPanelComponent } from './narrator-config/narrator-config-panel';
import { RoleplaySessionPanelComponent } from './session-management/roleplay-session-panel';
import { RoleplayWorkbench } from './roleplay-workbench';

const panelStyles = `
  :host {
    display: block;
    min-width: 0;
    max-height: calc(80vh - 2.5rem);
    overflow: auto;
    padding: var(--rv-space-md, 8px);
    color: var(--rv-color-text-primary, #1b1f24);
  }

  .panel-stack {
    display: grid;
    gap: var(--rv-space-lg, 16px);
  }

  .panel-error,
  .panel-state {
    margin: 0;
    font-size: var(--rv-font-size-sm, 0.8125rem);
  }

  .panel-error {
    color: var(--rv-color-danger, #cf222e);
  }

  .panel-state {
    color: var(--rv-color-text-muted, #7a828d);
  }

  .panel-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--rv-space-sm, 6px);
  }
`;

@Component({
  selector: 'app-roleplay-sessions-menu-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RoleplaySessionPanelComponent],
  template: `
    @if (workbench.activeProfile(); as profile) {
      @if (workbench.sessionError(); as error) {
        <p class="panel-error">{{ error }}</p>
      }
      <app-roleplay-session-panel
        [sessions]="workbench.roleplaySessions()"
        [characters]="workbench.characters()"
        [layers]="workbench.profileLayers()"
        [activeSessionId]="workbench.chatStore.activeSessionId()"
        [activeSessionPreview]="workbench.activeSessionPreview()"
        [highlightedSessionId]="workbench.highlightedSessionId()"
        [loading]="workbench.sessionsLoading()"
        [errorMessage]="workbench.sessionsError()"
        (sessionSelect)="workbench.selectSession(profile.id, $event)"
        (sessionCreate)="workbench.createSession(profile.id, $event)"
        (sessionRename)="workbench.renameSession($event)"
        (sessionArchive)="workbench.archiveSession(profile.id, $event)"
        (sessionRestore)="workbench.restoreSession(profile.id, $event)"
      />
    } @else {
      <p class="panel-state">Select a profile first.</p>
    }
  `,
  styles: [panelStyles],
})
export class RoleplaySessionsMenuPanelComponent {
  protected readonly workbench = inject(RoleplayWorkbench);
}

@Component({
  selector: 'app-roleplay-characters-menu-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RpCharacterManagerComponent],
  template: `
    @if (workbench.activeProfile(); as profile) {
      <rp-character-manager
        [characters]="workbench.characters()"
        [activeId]="workbench.activeCharacterId()"
        [loading]="workbench.charactersLoading()"
        [errorMessage]="workbench.charactersError()"
        (characterActivate)="workbench.activateCharacter($event)"
        (characterCreate)="workbench.createCharacter(profile.id, $event)"
        (characterUpdate)="workbench.updateCharacter(profile.id, $event)"
        (characterArchive)="workbench.archiveCharacter(profile.id, $event)"
      />
    } @else {
      <p class="panel-state">Select a profile first.</p>
    }
  `,
  styles: [panelStyles],
})
export class RoleplayCharactersMenuPanelComponent {
  protected readonly workbench = inject(RoleplayWorkbench);
}

@Component({
  selector: 'app-roleplay-lore-menu-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RpLorebookPanelComponent,
    LoreEntryEditorComponent,
    LoreLayerPanelComponent,
    TooltipDirective,
  ],
  template: `
    @if (workbench.activeProfile(); as profile) {
      <div class="panel-stack">
        <div class="panel-actions">
          <button
            type="button"
            rvTooltip="Create a lore entry in the first writable active layer"
            (click)="creating.set(true)"
          >
            New lore
          </button>
          @if (workbench.selectedLore()) {
            <button
              type="button"
              rvTooltip="Edit the selected lore entry"
              (click)="creating.set(false)"
            >
              Edit selected
            </button>
          }
        </div>
        <rp-lorebook-panel
          [entries]="workbench.lore()"
          [selectedEntry]="workbench.selectedLore()"
          [loading]="workbench.loreLoading()"
          [errorMessage]="workbench.loreError()"
          [promoteTargetLayers]="workbench.promoteTargetLayers()"
          [promotingEntryId]="workbench.promotingLoreEntryId()"
          (queryChange)="workbench.searchLore($event)"
          (selectEntry)="workbench.selectLore($event)"
          (promoteEntry)="workbench.promoteLoreEntry($event)"
        />
        @if (creating()) {
          <rp-lore-entry-editor
            [entry]="null"
            [disabled]="workbench.loreSaving()"
            (entrySave)="createLore(profile.id, $event)"
          />
        } @else if (workbench.selectedLore(); as entry) {
          <rp-lore-entry-editor
            [entry]="entry"
            [disabled]="workbench.loreSaving()"
            (entrySave)="updateLore(profile.id, $event)"
          />
        } @else {
          <p class="panel-state">Select or create a lore entry to edit it.</p>
        }
        <rp-lore-layer-panel
          [layers]="workbench.visibleLayers()"
          [loading]="workbench.layersLoading()"
          [errorMessage]="workbench.layersError()"
          (layerToggle)="workbench.toggleLayer($event)"
          (layerReorder)="workbench.reorderLayer($event)"
          (layerCreate)="workbench.createLayer(profile.id, $event)"
        />
      </div>
    } @else {
      <p class="panel-state">Select a profile first.</p>
    }
  `,
  styles: [panelStyles],
})
export class RoleplayLoreMenuPanelComponent {
  protected readonly workbench = inject(RoleplayWorkbench);
  protected readonly creating = signal(false);

  protected createLore(profileId: string, request: LoreEntryEditRequest): void {
    void this.workbench.createLoreEntry(profileId, request).then((saved) => {
      if (saved) {
        this.creating.set(false);
      }
    });
  }

  protected updateLore(profileId: string, request: LoreEntryEditRequest): void {
    void this.workbench.updateLoreEntry(profileId, request);
  }
}

@Component({
  selector: 'app-roleplay-narrator-menu-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ContextBreakdownComponent, NarratorConfigPanelComponent],
  template: `
    @if (workbench.activeProfile(); as profile) {
      <app-narrator-config-panel
        [config]="workbench.narratorConfig()"
        [loading]="workbench.narratorConfigLoading()"
        [saving]="workbench.narratorConfigSaving()"
        [errorMessage]="workbench.narratorConfigError()"
        (configReload)="workbench.reloadNarratorConfig(profile.id)"
        (configSave)="workbench.saveNarratorConfig(profile.id, $event)"
      />
      <app-context-breakdown
        [usage]="workbench.contextUsage()"
        [activeSessionId]="workbench.chatStore.activeSessionId() ?? undefined"
        [loading]="workbench.contextLoading()"
        [errorMessage]="workbench.contextError()"
        (refresh)="workbench.refreshContextUsage()"
      />
    } @else {
      <p class="panel-state">Select a profile first.</p>
    }
  `,
  styles: [panelStyles],
})
export class RoleplayNarratorMenuPanelComponent {
  protected readonly workbench = inject(RoleplayWorkbench);
}

@Component({
  selector: 'app-roleplay-mechanics-menu-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RpSceneControlsComponent, RpMechanicPanelComponent],
  template: `
    <div class="panel-stack">
      <rp-scene-controls
        [phase]="workbench.phase()"
        [mood]="workbench.mood()"
        (moodChange)="workbench.mood.set($event)"
      />
      <rp-mechanic-panel
        [mode]="workbench.mode()"
        [proposals]="workbench.proposals"
        [logs]="workbench.logs"
        (modeChange)="workbench.mode.set($event)"
      />
    </div>
  `,
  styles: [panelStyles],
})
export class RoleplayMechanicsMenuPanelComponent {
  protected readonly workbench = inject(RoleplayWorkbench);
}
