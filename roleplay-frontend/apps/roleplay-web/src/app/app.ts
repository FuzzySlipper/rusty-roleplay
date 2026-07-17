import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  RpProfileSelectorComponent,
  type ProfileSelection,
} from '@rusty-roleplay/rp-profile';
import { RpLayoutComponent } from '@rusty-roleplay/rp-layout';

import { RoleplayWorkbench } from './roleplay-workbench';

/**
 * Roleplay-web shell. The transcript remains the first screen; RP tools are
 * downstream top-menu panels registered against rusty-view's menu extension
 * surface.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RpProfileSelectorComponent, RpLayoutComponent],
  template: `
    @if (workbench.activeProfile(); as profile) {
      <rp-layout
        [messages]="workbench.transcriptMessages()"
        [profileName]="profile.name"
        [connectionStatus]="workbench.connectionStatus()"
        [phase]="workbench.phase()"
        [sceneLabel]="workbench.sceneLabel()"
        [sendDisabled]="workbench.sendDisabled()"
        [searchEnabled]="workbench.transcriptSearchEnabled()"
        [alternateSlots]="workbench.alternateSlots()"
        [revisionCapabilities]="workbench.revisionCapabilities()"
        (send)="workbench.send($event)"
        (reconnect)="workbench.reconnect()"
        (revisionRequested)="workbench.handleRevisionAction($event)"
      />
    } @else {
      <rp-profile-selector
        [profiles]="workbench.profileStore.profiles()"
        [errorMessage]="workbench.selectError()"
        (selectProfile)="onProfileSelect($event)"
      />
      @if (workbench.profilesLoading()) {
        <p role="status">Loading…</p>
      }
    }
  `,
})
export class App {
  protected readonly workbench = inject(RoleplayWorkbench);

  protected onProfileSelect(selection: ProfileSelection): void {
    this.workbench.selectProfile(selection);
  }
}
