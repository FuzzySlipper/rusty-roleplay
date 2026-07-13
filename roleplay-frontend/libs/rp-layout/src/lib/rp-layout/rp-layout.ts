import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import type { ChatMessage } from '@rusty-view/chat-domain';
import type { MessageAlternateSlot } from '@rusty-view/chat-domain';
import {
  MessageInputComponent,
  StreamStatusComponent,
  TooltipDirective,
  type StreamStatusKind,
} from '@rusty-view/chat-components';
import { TopMenuComponent, TopMenuController } from '@rusty-view/chat-shell';
import { TranscriptViewportComponent } from '@rusty-view/transcript-renderer';
import type {
  MessageRevisionAction,
  MessageRevisionCapabilities,
} from '@rusty-view/transcript-renderer';
import {
  NarratorPhaseIndicatorComponent,
  type NarratorPhase,
} from '@rusty-roleplay/rp-scene-controls';

/**
 * Roleplay shell layout. Composes rusty-view's base chat mechanics — the
 * virtualized transcript viewport and the message input — and adds the RP
 * chrome: a header, a left sidebar slot, and a right RP panel slot.
 *
 * The base chat components are consumed untouched; RP-specific content is
 * supplied by the container through the [rpSidebar] and [rpPanel] projection
 * slots. This keeps the boundary intact: rp-layout knows the rusty-view public
 * API, not its internals.
 */
@Component({
  selector: 'rp-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranscriptViewportComponent,
    MessageInputComponent,
    StreamStatusComponent,
    TooltipDirective,
    TopMenuComponent,
    NarratorPhaseIndicatorComponent,
  ],
  template: `
    <div class="rp-layout">
      <header class="header">
        <span class="brand">rusty-roleplay</span>
        <rv-top-menu />
        <button
          class="scene"
          type="button"
          rvTooltip="Open sessions"
          (click)="openSessionsPanel()"
        >
          {{ sceneLabel() }}
        </button>
        <rv-stream-status
          class="status"
          [status]="connectionStatus()"
          (reconnect)="reconnect.emit()"
        />
        <span class="profile">{{ profileName() }}</span>
      </header>

      <main class="transcript-region">
        <rv-transcript-viewport
          class="transcript"
          [messages]="messages()"
          [searchEnabled]="searchEnabled()"
          [alternateSlots]="alternateSlots()"
          [revisionCapabilities]="revisionCapabilities()"
          (revisionRequested)="revisionRequested.emit($event)"
        />
        <div class="phase-bar">
          <rp-narrator-phase-indicator [phase]="phase()" />
        </div>
        <div class="input">
          <rv-message-input
            [disabled]="sendDisabled()"
            (send)="send.emit($event)"
          />
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      .rp-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto 1fr;
        grid-template-areas:
          'header'
          'transcript';
        height: 100vh;
      }
      .header {
        grid-area: header;
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.5rem 1rem;
        border-bottom: 1px solid rgba(128, 128, 128, 0.4);
      }
      .brand {
        font-weight: 600;
      }
      .scene {
        appearance: none;
        border: 1px solid var(--rv-color-border, rgba(128, 128, 128, 0.4));
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface-raised, transparent);
        color: inherit;
        cursor: pointer;
        font: inherit;
        max-width: min(24rem, 35vw);
        overflow: hidden;
        padding: 0.25rem 0.5rem;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .scene:hover,
      .scene:focus-visible {
        border-color: var(--rv-color-accent, currentColor);
      }
      .status {
        margin-left: auto;
      }
      .transcript-region {
        grid-area: transcript;
        display: grid;
        grid-template-rows: 1fr auto auto;
        min-height: 0;
      }
      .transcript {
        min-height: 0;
        overflow: hidden;
      }
      .phase-bar {
        min-height: 2rem;
        padding: 0.35rem 1rem;
        border-top: 1px solid rgba(128, 128, 128, 0.25);
        background: color-mix(
          in srgb,
          var(--rv-color-surface, #fff) 90%,
          transparent
        );
      }
      .input {
        border-top: 1px solid rgba(128, 128, 128, 0.4);
        padding: 0.5rem;
      }
    `,
  ],
})
export class RpLayoutComponent {
  private readonly topMenu = inject(TopMenuController);

  readonly messages = input.required<readonly ChatMessage[]>();
  readonly profileName = input<string>('');
  readonly connectionStatus = input<StreamStatusKind>('idle');
  readonly phase = input<NarratorPhase>('idle');
  readonly sceneLabel = input<string>('');
  readonly sendDisabled = input<boolean>(false);
  readonly searchEnabled = input<boolean>(false);
  readonly alternateSlots = input<readonly MessageAlternateSlot[]>([]);
  readonly revisionCapabilities = input<MessageRevisionCapabilities>({});

  readonly send = output<string>();
  readonly reconnect = output<void>();
  readonly revisionRequested = output<MessageRevisionAction>();

  protected openSessionsPanel(): void {
    this.topMenu.openPanel('rp-sessions');
  }
}
