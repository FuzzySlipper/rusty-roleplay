import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import type { ChatMessage } from '@rusty-view/chat-domain';
import { MessageInputComponent } from '@rusty-view/chat-components';
import { TranscriptViewportComponent } from '@rusty-view/transcript-renderer';

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
  imports: [TranscriptViewportComponent, MessageInputComponent],
  template: `
    <div class="rp-layout">
      <header class="header">
        <span class="brand">rusty-roleplay</span>
        <span class="scene">{{ sceneLabel() }}</span>
        <span class="status" [attr.data-status]="connectionStatus()">
          {{ connectionStatus() }}
        </span>
        <span class="profile">{{ profileName() }}</span>
      </header>

      <aside class="sidebar">
        <ng-content select="[rpSidebar]" />
      </aside>

      <main class="transcript-region">
        <rv-transcript-viewport class="transcript" [messages]="messages()" />
        <div class="input">
          <rv-message-input
            [disabled]="sendDisabled()"
            (send)="send.emit($event)"
          />
        </div>
      </main>

      <aside class="panel">
        <ng-content select="[rpPanel]" />
      </aside>
    </div>
  `,
  styles: [
    `
      .rp-layout {
        display: grid;
        grid-template-columns: 16rem 1fr 18rem;
        grid-template-rows: auto 1fr;
        grid-template-areas:
          'header header header'
          'sidebar transcript panel';
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
      .status {
        margin-left: auto;
        font-size: 0.8rem;
        opacity: 0.8;
      }
      .status[data-status='connected'] {
        color: #2a8f3c;
      }
      .sidebar {
        grid-area: sidebar;
        padding: 0.75rem;
        border-right: 1px solid rgba(128, 128, 128, 0.4);
        overflow-y: auto;
      }
      .transcript-region {
        grid-area: transcript;
        display: grid;
        grid-template-rows: 1fr auto;
        min-height: 0;
      }
      .transcript {
        min-height: 0;
        overflow: hidden;
      }
      .input {
        border-top: 1px solid rgba(128, 128, 128, 0.4);
        padding: 0.5rem;
      }
      .panel {
        grid-area: panel;
        padding: 0.75rem;
        border-left: 1px solid rgba(128, 128, 128, 0.4);
        overflow-y: auto;
      }
    `,
  ],
})
export class RpLayoutComponent {
  readonly messages = input.required<readonly ChatMessage[]>();
  readonly profileName = input<string>('');
  readonly connectionStatus = input<string>('offline');
  readonly sceneLabel = input<string>('');
  readonly sendDisabled = input<boolean>(false);

  readonly send = output<string>();
}
