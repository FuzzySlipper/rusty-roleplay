import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/** Top-level UI mode: in-character roleplay vs out-of-character diagnostics. */
export type RpMode = 'roleplay' | 'mechanic';

/** A diagnostic proposal the mechanic agent surfaces for user approval. */
export interface MechanicProposal {
  readonly id: string;
  readonly summary: string;
  readonly reason: string;
}

/** A diagnostic log line shown in mechanic mode. */
export interface DiagnosticLine {
  readonly timestamp: string;
  readonly message: string;
}

/**
 * OOC mechanic panel: a mode toggle, a proposal review list (apply/reject), and
 * a diagnostic log view. Presentational — proposals and logs come in via
 * inputs; decisions and the mode toggle are emitted to the container.
 */
@Component({
  selector: 'rp-mechanic-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rp-mechanic">
      <header>
        <h3>Mechanic</h3>
        <button type="button" (click)="toggleMode()">
          {{
            mode() === 'mechanic' ? 'Return to roleplay' : 'Enter mechanic mode'
          }}
        </button>
      </header>

      @if (mode() === 'mechanic') {
        <div class="proposals">
          <h4>Proposals</h4>
          @for (proposal of proposals(); track proposal.id) {
            <article class="proposal">
              <p class="summary">{{ proposal.summary }}</p>
              <p class="reason">{{ proposal.reason }}</p>
              <div class="actions">
                <button type="button" (click)="apply.emit(proposal.id)">
                  Apply
                </button>
                <button type="button" (click)="reject.emit(proposal.id)">
                  Reject
                </button>
              </div>
            </article>
          } @empty {
            <p class="empty">No open proposals.</p>
          }
        </div>

        <div class="log">
          <h4>Diagnostic log</h4>
          <ul>
            @for (line of logs(); track line.timestamp) {
              <li>
                <time>{{ line.timestamp }}</time> {{ line.message }}
              </li>
            }
          </ul>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .proposal {
        border: 1px solid currentColor;
        border-radius: 4px;
        padding: 0.5rem;
        margin-bottom: 0.5rem;
      }
      .reason {
        font-size: 0.85rem;
        opacity: 0.8;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
      }
      .log ul {
        list-style: none;
        padding: 0;
        font-size: 0.8rem;
      }
      .log time {
        opacity: 0.6;
        margin-right: 0.4rem;
      }
      .empty {
        opacity: 0.6;
        font-style: italic;
      }
    `,
  ],
})
export class RpMechanicPanelComponent {
  readonly mode = input<RpMode>('roleplay');
  readonly proposals = input<readonly MechanicProposal[]>([]);
  readonly logs = input<readonly DiagnosticLine[]>([]);

  readonly modeChange = output<RpMode>();
  readonly apply = output<string>();
  readonly reject = output<string>();

  protected toggleMode(): void {
    this.modeChange.emit(this.mode() === 'mechanic' ? 'roleplay' : 'mechanic');
  }
}
