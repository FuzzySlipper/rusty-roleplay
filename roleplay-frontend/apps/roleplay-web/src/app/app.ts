import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RpLayoutComponent } from '@rusty-roleplay/rp-layout';

import { FirstNarratorSetupComponent } from './profile-registry/first-narrator-setup';
import { RoleplayWorkbench } from './roleplay-workbench';

/**
 * Roleplay-web shell. The transcript remains the first screen; RP tools are
 * downstream top-menu panels registered against rusty-view's menu extension
 * surface.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FirstNarratorSetupComponent, RpLayoutComponent],
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
        [showModelActivity]="workbench.showModelActivity()"
        [alternateSlots]="workbench.alternateSlots()"
        [revisionCapabilities]="workbench.revisionCapabilities()"
        (send)="workbench.send($event)"
        (reconnect)="workbench.reconnect()"
        (revisionRequested)="workbench.handleRevisionAction($event)"
        (showModelActivityChange)="workbench.setModelActivityVisible($event)"
      />
    } @else {
      <main class="startup">
        <h1>rusty-roleplay</h1>
        @if (workbench.profilesLoading()) {
          <p role="status">Opening roleplay…</p>
        } @else if (workbench.firstNarratorSetupAvailable()) {
          <app-first-narrator-setup
            [errorMessage]="workbench.selectError()"
            [saving]="workbench.firstNarratorSetupSaving()"
            (narratorCreate)="workbench.createFirstNarrator($event)"
            (retry)="workbench.retryStartup()"
          />
        } @else if (workbench.selectError(); as error) {
          <p role="alert">{{ error }}</p>
          <button type="button" (click)="workbench.retryStartup()">
            Retry
          </button>
        }
      </main>
    }
  `,
  styles: [
    `
      .startup {
        align-content: center;
        background: var(--rv-color-surface-base, #111318);
        color: var(--rv-color-text-primary, #f3f4f6);
        display: grid;
        gap: var(--rv-space-md, 12px);
        height: 100dvh;
        justify-items: center;
        overflow: auto;
        padding: var(--rv-space-xl, 24px);
        text-align: center;
      }

      .startup h1,
      .startup p {
        margin: 0;
      }

      .startup p {
        color: var(--rv-color-text-muted, #9ca3af);
      }

      .startup button {
        background: var(--rv-color-surface-raised, #20242b);
        border: 1px solid var(--rv-color-border-subtle, #4b5563);
        border-radius: 6px;
        color: inherit;
        cursor: pointer;
        padding: 0.5rem 0.8rem;
      }
    `,
  ],
})
export class App {
  protected readonly workbench = inject(RoleplayWorkbench);
}
