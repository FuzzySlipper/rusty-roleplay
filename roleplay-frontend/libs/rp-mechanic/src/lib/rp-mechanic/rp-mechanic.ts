import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { TooltipDirective } from '@rusty-view/chat-components';

import {
  MECHANIC_DIAGNOSTIC_OUTCOMES,
  MECHANIC_PROPOSAL_KINDS,
  type MechanicDiagnostic,
  type MechanicDiagnosticOutcome,
  type MechanicDiagnosticOutcomeWrite,
  type MechanicProfileConfig,
  type MechanicProfileConfigWrite,
  type MechanicProfileOption,
  type MechanicProposal,
  type MechanicProposalBatchDecision,
  type MechanicProposalDecision,
  type MechanicProposalKind,
  type MechanicProposalStatus,
  type MechanicSessionAttachment,
  type MechanicSessionSummary,
  type RpMode,
} from '../mechanic.model';

type MechanicTab = 'profile' | 'sessions' | 'proposals' | 'diagnostics';
type SessionFilter = 'active' | 'archived' | 'all';
type ProposalFilter = MechanicProposalStatus | 'all';
type DiagnosticFilter = MechanicDiagnosticOutcome | 'all';

/**
 * Presentational mechanic/OOC workbench. Rusty Crew remains authoritative for
 * profiles, sessions, proposals, and diagnostics; this component only renders
 * typed inputs and emits user intent to its container.
 */
@Component({
  selector: 'rp-mechanic-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  template: `
    <section class="mechanic" [class.mechanic-mode]="mode() === 'mechanic'">
      <header class="mode-header">
        <div>
          <p class="eyebrow">Out-of-character workspace</p>
          <h3>{{ config()?.name || 'Mechanic' }}</h3>
        </div>
        <button
          type="button"
          class="mode-toggle"
          [class.active]="mode() === 'mechanic'"
          [rvTooltip]="
            mode() === 'mechanic'
              ? 'Return to the in-character roleplay session'
              : 'Open separate mechanic sessions and diagnostic tools'
          "
          rvTooltipPlacement="bottom"
          (click)="toggleMode()"
        >
          {{ mode() === 'mechanic' ? 'Return to RP' : 'Enter mechanic mode' }}
        </button>
      </header>

      <p class="boundary-note">
        Mechanic chat is separate from narrator history. Proposed changes stay
        inert until you approve and apply them.
      </p>

      <nav class="tabs" aria-label="Mechanic sections">
        @for (item of tabs; track item.id) {
          <button
            type="button"
            [class.active]="tab() === item.id"
            [attr.aria-pressed]="tab() === item.id"
            (click)="tab.set(item.id)"
          >
            {{ item.label }}
            @if (item.id === 'proposals' && pendingProposalCount() > 0) {
              <span class="count">{{ pendingProposalCount() }}</span>
            }
          </button>
        }
      </nav>

      @if (errorMessage()) {
        <p class="state error">{{ errorMessage() }}</p>
      }
      @if (loading()) {
        <p class="state">Refreshing mechanic data...</p>
      }

      @switch (tab()) {
        @case ('profile') {
          <section class="pane profile-pane">
            <div class="section-heading">
              <div>
                <h4>Mechanic profile</h4>
                <p>Choose a profile that is separate from the narrator.</p>
              </div>
              <button
                type="button"
                rvTooltip="Reload the selected mechanic profile config"
                (click)="configReload.emit()"
                [disabled]="loading()"
              >
                Reload
              </button>
            </div>

            <label>
              Profile
              <select
                [value]="mechanicProfileId()"
                (change)="selectProfile($event)"
              >
                <option value="" [selected]="mechanicProfileId() === ''">
                  Select a mechanic profile
                </option>
                @for (profile of profileOptions(); track profile.id) {
                  <option
                    [value]="profile.id"
                    [selected]="profile.id === mechanicProfileId()"
                  >
                    {{ profile.name }}
                  </option>
                }
              </select>
            </label>

            @if (config(); as value) {
              <form (submit)="saveConfig($event, value)">
                <label>
                  Name
                  <input
                    name="mechanicName"
                    type="text"
                    [value]="draftName() || value.name"
                    (input)="draftName.set(inputValue($event))"
                  />
                </label>
                <label>
                  Model provider alias
                  <input
                    name="providerAlias"
                    type="text"
                    [value]="draftProviderAlias() || value.providerAlias || ''"
                    placeholder="Use the profile default"
                    (input)="draftProviderAlias.set(inputValue($event))"
                  />
                </label>
                <label class="check disabled">
                  <input
                    type="checkbox"
                    [checked]="value.autoMonitor.enabled"
                    disabled
                  />
                  Automatic monitoring (future capability)
                </label>
                <dl class="facts">
                  <div>
                    <dt>Profile status</dt>
                    <dd>
                      {{ value.configured ? 'Configured' : 'Not configured' }}
                    </dd>
                  </div>
                  <div>
                    <dt>Tool profile</dt>
                    <dd>{{ value.localToolProfileId }}</dd>
                  </div>
                  <div>
                    <dt>Tool isolation</dt>
                    <dd>
                      {{
                        value.toolPolicyIsolated ? 'Verified' : 'Pending save'
                      }}
                    </dd>
                  </div>
                  <div>
                    <dt>Applies</dt>
                    <dd>{{ label(value.applies) }}</dd>
                  </div>
                </dl>
                <div class="actions">
                  <button
                    type="submit"
                    rvTooltip="Save this profile as the isolated roleplay mechanic"
                    [disabled]="saving() || mechanicProfileId() === ''"
                  >
                    Save mechanic profile
                  </button>
                </div>
              </form>
            } @else {
              <p class="state">Select a profile to inspect or configure it.</p>
            }
          </section>
        }

        @case ('sessions') {
          <section class="pane">
            <div class="section-heading">
              <div>
                <h4>Mechanic sessions</h4>
                <p>
                  Independent OOC history, optionally attached to the current
                  RP.
                </p>
              </div>
              <button
                type="button"
                rvTooltip="Create a new mechanic conversation"
                (click)="sessionCreate.emit()"
                [disabled]="mechanicProfileId() === '' || saving()"
              >
                New mechanic chat
              </button>
            </div>
            <div class="toolbar">
              <label>
                Show
                <select
                  [value]="sessionFilter()"
                  (change)="setSessionFilter($event)"
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="all">All</option>
                </select>
              </label>
            </div>
            <ul class="cards">
              @for (
                session of visibleSessions();
                track session.association.mechanicSessionId
              ) {
                <li
                  [class.selected]="
                    session.association.mechanicSessionId ===
                    activeMechanicSessionId()
                  "
                >
                  <button
                    type="button"
                    class="card-main"
                    (click)="
                      sessionSelect.emit(session.association.mechanicSessionId)
                    "
                  >
                    <strong>{{
                      session.title ||
                        shortId(session.association.mechanicSessionId)
                    }}</strong>
                    <span>{{
                      session.archived ? 'Archived' : label(session.status)
                    }}</span>
                    <span>
                      RP:
                      {{
                        session.association.roleplaySessionId || 'not attached'
                      }}
                    </span>
                  </button>
                  <div class="actions">
                    @if (
                      activeRoleplaySessionId() &&
                      session.association.roleplaySessionId !==
                        activeRoleplaySessionId()
                    ) {
                      <button
                        type="button"
                        rvTooltip="Attach this mechanic chat to the active RP session"
                        (click)="attachToActiveRoleplay(session)"
                      >
                        Attach current RP
                      </button>
                    }
                    @if (session.archived) {
                      <button
                        type="button"
                        (click)="
                          sessionRestore.emit(
                            session.association.mechanicSessionId
                          )
                        "
                      >
                        Restore
                      </button>
                    } @else {
                      <button
                        type="button"
                        (click)="
                          sessionArchive.emit(
                            session.association.mechanicSessionId
                          )
                        "
                      >
                        Archive
                      </button>
                    }
                  </div>
                </li>
              } @empty {
                <li class="empty">No mechanic sessions match this filter.</li>
              }
            </ul>
          </section>
        }

        @case ('proposals') {
          <section class="pane">
            <div class="section-heading">
              <div>
                <h4>Proposed fixes</h4>
                <p>Review captured before/after values before deciding.</p>
              </div>
              <button type="button" (click)="refresh.emit()">Refresh</button>
            </div>
            <div class="toolbar filters">
              <label>
                Status
                <select
                  [value]="proposalFilter()"
                  (change)="setProposalFilter($event)"
                >
                  <option value="all">All</option>
                  <option value="proposed">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="applied">Applied</option>
                </select>
              </label>
              <label>
                Kind
                <select
                  [value]="proposalKindFilter()"
                  (change)="setProposalKindFilter($event)"
                >
                  <option value="all">All</option>
                  @for (kind of proposalKinds; track kind) {
                    <option [value]="kind">{{ label(kind) }}</option>
                  }
                </select>
              </label>
            </div>

            <div class="review-grid">
              <div>
                <label class="check batch-check">
                  <input
                    type="checkbox"
                    [checked]="allVisiblePendingSelected()"
                    (change)="toggleAllVisiblePending($event)"
                  />
                  Select visible pending proposals
                </label>
                <ul class="cards proposal-list">
                  @for (
                    proposal of visibleProposals();
                    track proposal.proposalId
                  ) {
                    <li
                      [class.selected]="
                        selectedProposal()?.proposalId === proposal.proposalId
                      "
                    >
                      <div class="proposal-row">
                        <input
                          type="checkbox"
                          [checked]="
                            selectedProposalIds().includes(proposal.proposalId)
                          "
                          [disabled]="proposal.status !== 'proposed'"
                          [attr.aria-label]="'Select ' + proposal.proposalId"
                          (change)="toggleProposal(proposal.proposalId, $event)"
                        />
                        <button
                          type="button"
                          class="card-main"
                          (click)="selectedProposalId.set(proposal.proposalId)"
                        >
                          <strong>{{ label(proposal.kind) }}</strong>
                          <span
                            class="status"
                            [attr.data-status]="proposal.status"
                          >
                            {{ label(proposal.status) }}
                          </span>
                          <span>{{ proposal.rationale }}</span>
                        </button>
                      </div>
                    </li>
                  } @empty {
                    <li class="empty">No proposals match these filters.</li>
                  }
                </ul>
              </div>

              @if (selectedProposal(); as proposal) {
                <article class="detail">
                  <div class="detail-heading">
                    <div>
                      <p class="eyebrow">{{ proposal.proposalId }}</p>
                      <h5>{{ label(proposal.kind) }}</h5>
                    </div>
                    <span class="status" [attr.data-status]="proposal.status">
                      {{ label(proposal.status) }}
                    </span>
                  </div>
                  <p>{{ proposal.rationale }}</p>
                  <div
                    class="diff"
                    aria-label="Proposal before and after values"
                  >
                    <section>
                      <h6>Before</h6>
                      <pre>{{ json(proposal.beforeValue) }}</pre>
                    </section>
                    <section>
                      <h6>Proposed</h6>
                      <pre>{{ json(proposal.proposedValue) }}</pre>
                    </section>
                  </div>
                  @if (proposal.history.length > 0) {
                    <details>
                      <summary>
                        Audit history ({{ proposal.history.length }})
                      </summary>
                      <ol class="history">
                        @for (event of proposal.history; track event.eventId) {
                          <li>
                            <strong>{{ label(event.kind) }}</strong>
                            by {{ event.actorId }}
                            @if (event.note) {
                              — {{ event.note }}
                            }
                          </li>
                        }
                      </ol>
                    </details>
                  }
                  <div class="actions">
                    @if (proposal.status === 'proposed') {
                      <button
                        type="button"
                        (click)="decideOne(proposal, 'approve')"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        (click)="decideOne(proposal, 'reject')"
                      >
                        Reject
                      </button>
                    }
                    @if (proposal.status === 'approved') {
                      <button
                        type="button"
                        (click)="proposalApply.emit(proposal.proposalId)"
                      >
                        Apply approved change
                      </button>
                    }
                  </div>
                </article>
              }
            </div>

            <fieldset class="batch">
              <legend>Decision identity</legend>
              <label>
                Reviewer
                <input
                  type="text"
                  [value]="reviewerId()"
                  (input)="reviewerId.set(inputValue($event))"
                />
              </label>
              <label>
                Note
                <input
                  type="text"
                  [value]="reviewNote()"
                  (input)="reviewNote.set(inputValue($event))"
                />
              </label>
              <div class="actions">
                <button
                  type="button"
                  (click)="decideBatch('approve')"
                  [disabled]="
                    selectedProposalIds().length === 0 ||
                    reviewerId().trim() === ''
                  "
                >
                  Approve selected
                </button>
                <button
                  type="button"
                  (click)="decideBatch('reject')"
                  [disabled]="
                    selectedProposalIds().length === 0 ||
                    reviewerId().trim() === ''
                  "
                >
                  Reject selected
                </button>
              </div>
            </fieldset>
          </section>
        }

        @case ('diagnostics') {
          <section class="pane">
            <div class="section-heading">
              <div>
                <h4>Diagnostic log</h4>
                <p>
                  Track symptoms, hypotheses, linked fixes, and observed
                  outcomes.
                </p>
              </div>
              <button type="button" (click)="refresh.emit()">Refresh</button>
            </div>
            <div class="toolbar filters">
              <label>
                Outcome
                <select
                  [value]="diagnosticFilter()"
                  (change)="setDiagnosticFilter($event)"
                >
                  <option value="all">All</option>
                  @for (outcome of diagnosticOutcomes; track outcome) {
                    <option [value]="outcome">{{ label(outcome) }}</option>
                  }
                </select>
              </label>
              <label>
                Proposal ID
                <input
                  type="search"
                  [value]="diagnosticProposalFilter()"
                  (input)="diagnosticProposalFilter.set(inputValue($event))"
                  placeholder="Filter linked proposal"
                />
              </label>
            </div>
            <div class="review-grid">
              <ul class="cards">
                @for (
                  diagnostic of visibleDiagnostics();
                  track diagnostic.diagnosticId
                ) {
                  <li
                    [class.selected]="
                      selectedDiagnostic()?.diagnosticId ===
                      diagnostic.diagnosticId
                    "
                  >
                    <button
                      type="button"
                      class="card-main"
                      (click)="
                        selectedDiagnosticId.set(diagnostic.diagnosticId)
                      "
                    >
                      <strong>{{ diagnostic.symptom }}</strong>
                      <span
                        class="status"
                        [attr.data-status]="diagnostic.outcome"
                      >
                        {{ label(diagnostic.outcome) }}
                      </span>
                      <span>{{ diagnostic.updatedAt }}</span>
                    </button>
                  </li>
                } @empty {
                  <li class="empty">
                    No diagnostic records match these filters.
                  </li>
                }
              </ul>
              @if (selectedDiagnostic(); as diagnostic) {
                <article class="detail">
                  <p class="eyebrow">{{ diagnostic.diagnosticId }}</p>
                  <h5>{{ diagnostic.symptom }}</h5>
                  <dl class="diagnostic-facts">
                    <div>
                      <dt>Hypothesis</dt>
                      <dd>{{ diagnostic.hypothesis }}</dd>
                    </div>
                    <div>
                      <dt>Roleplay session</dt>
                      <dd>{{ diagnostic.roleplaySessionId }}</dd>
                    </div>
                    <div>
                      <dt>Proposals</dt>
                      <dd>
                        @for (
                          proposalId of diagnostic.proposalIds;
                          track proposalId
                        ) {
                          <button
                            type="button"
                            class="link-button"
                            (click)="openProposal(proposalId)"
                          >
                            {{ proposalId }}
                          </button>
                        } @empty {
                          None
                        }
                      </dd>
                    </div>
                  </dl>
                  <label>
                    Outcome
                    <select
                      [value]="diagnosticDraftOutcome() || diagnostic.outcome"
                      (change)="setDiagnosticDraftOutcome($event)"
                    >
                      @for (outcome of diagnosticOutcomes; track outcome) {
                        <option [value]="outcome">{{ label(outcome) }}</option>
                      }
                    </select>
                  </label>
                  <label>
                    Follow-up notes
                    <textarea
                      rows="4"
                      [value]="diagnosticDraftNotes() || diagnostic.notes || ''"
                      (input)="diagnosticDraftNotes.set(inputValue($event))"
                    ></textarea>
                  </label>
                  <div class="actions">
                    <button
                      type="button"
                      (click)="saveDiagnosticOutcome(diagnostic)"
                    >
                      Save outcome
                    </button>
                  </div>
                </article>
              }
            </div>
          </section>
        }
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .mechanic {
        display: grid;
        gap: var(--rv-space-md, 8px);
        padding: var(--rv-space-sm, 6px);
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 6px);
      }

      .mechanic-mode {
        border-color: var(--rv-color-warning, #bf8700);
        box-shadow: inset 0 3px 0 var(--rv-color-warning, #bf8700);
      }

      .mode-header,
      .section-heading,
      .detail-heading,
      .toolbar,
      .actions,
      .proposal-row,
      .tabs {
        display: flex;
        align-items: center;
        gap: var(--rv-space-sm, 6px);
      }

      .mode-header,
      .section-heading,
      .detail-heading {
        justify-content: space-between;
      }

      h3,
      h4,
      h5,
      h6,
      p,
      dl,
      dd {
        margin: 0;
      }

      .eyebrow,
      .state,
      .boundary-note,
      .section-heading p,
      .card-main span,
      dt {
        color: var(--rv-color-text-secondary, #69717d);
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-size: var(--rv-font-size-xs, 0.7rem);
      }

      .boundary-note {
        padding: var(--rv-space-sm, 6px);
        border-left: 3px solid var(--rv-color-warning, #bf8700);
        background: var(--rv-color-surface-alt, #f6f7f9);
      }

      .tabs {
        overflow-x: auto;
        padding-bottom: 2px;
      }

      .tabs button.active,
      .mode-toggle.active {
        border-color: var(--rv-color-warning, #bf8700);
        color: var(--rv-color-warning, #9a6700);
      }

      .count {
        display: inline-grid;
        place-items: center;
        min-width: 1.25rem;
        height: 1.25rem;
        border-radius: 999px;
        background: var(--rv-color-warning, #bf8700);
        color: #fff;
        font-size: 0.7rem;
      }

      .pane,
      form,
      fieldset,
      .detail,
      .facts,
      .diagnostic-facts {
        display: grid;
        gap: var(--rv-space-md, 8px);
      }

      label {
        display: grid;
        gap: 0.2rem;
        color: var(--rv-color-text-secondary, #48515d);
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .check {
        display: flex;
        align-items: center;
      }

      .check input {
        width: auto;
      }

      .disabled {
        opacity: 0.65;
      }

      button,
      input,
      select,
      textarea {
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface, #fff);
        color: var(--rv-color-text-primary, #1b1f24);
        font: inherit;
      }

      button,
      input,
      select {
        min-height: var(--rv-density-control-md, 30px);
      }

      button {
        cursor: pointer;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      input,
      select,
      textarea {
        width: 100%;
        padding: 0.3rem 0.4rem;
      }

      .facts,
      .diagnostic-facts {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .facts div,
      .diagnostic-facts div {
        min-width: 0;
        padding: var(--rv-space-sm, 6px);
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface-alt, #f6f7f9);
      }

      dd {
        overflow-wrap: anywhere;
      }

      .filters {
        flex-wrap: wrap;
      }

      .filters label {
        min-width: 10rem;
        flex: 1;
      }

      .cards {
        display: grid;
        gap: var(--rv-space-sm, 6px);
        padding: 0;
        margin: 0;
        list-style: none;
      }

      .cards li {
        display: grid;
        gap: var(--rv-space-sm, 6px);
        padding: var(--rv-space-sm, 6px);
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
      }

      .cards li.selected {
        border-color: var(--rv-color-accent, #0969da);
        box-shadow: 0 0 0 1px var(--rv-color-accent, #0969da);
      }

      .card-main {
        display: grid;
        gap: 0.15rem;
        width: 100%;
        min-width: 0;
        padding: 0;
        border: 0;
        background: transparent;
        text-align: left;
      }

      .proposal-row .card-main {
        flex: 1;
      }

      .proposal-row > input {
        width: auto;
      }

      .review-grid {
        display: grid;
        grid-template-columns: minmax(14rem, 0.8fr) minmax(20rem, 1.2fr);
        gap: var(--rv-space-md, 8px);
        align-items: start;
      }

      .detail {
        min-width: 0;
        padding: var(--rv-space-md, 8px);
        border: 1px solid var(--rv-color-border, #d7dbe0);
        border-radius: var(--rv-radius, 4px);
        background: var(--rv-color-surface-alt, #f6f7f9);
      }

      .diff {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--rv-space-sm, 6px);
      }

      pre {
        max-height: 18rem;
        overflow: auto;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        padding: var(--rv-space-sm, 6px);
        border: 1px solid var(--rv-color-border, #d7dbe0);
        background: var(--rv-color-surface, #fff);
        font-size: var(--rv-font-size-xs, 0.75rem);
      }

      .status {
        width: fit-content;
        padding: 0.05rem 0.35rem;
        border-radius: 999px;
        background: var(--rv-color-surface-alt, #f6f7f9);
      }

      .status[data-status='proposed'],
      .status[data-status='pending'] {
        color: var(--rv-color-warning, #9a6700);
      }

      .status[data-status='approved'],
      .status[data-status='applied'],
      .status[data-status='improved'] {
        color: var(--rv-color-success, #1a7f37);
      }

      .status[data-status='rejected'],
      .status[data-status='worse'] {
        color: var(--rv-color-danger, #cf222e);
      }

      .history {
        padding-left: 1.2rem;
        font-size: var(--rv-font-size-sm, 0.8125rem);
      }

      .batch {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .batch legend,
      .batch .actions {
        grid-column: 1 / -1;
      }

      .link-button {
        display: block;
        width: 100%;
        min-height: 0;
        padding: 0;
        border: 0;
        color: var(--rv-color-accent, #0969da);
        background: transparent;
        text-align: left;
        overflow-wrap: anywhere;
      }

      .empty {
        color: var(--rv-color-text-secondary, #69717d);
        font-style: italic;
      }

      .error {
        color: var(--rv-color-danger, #cf222e);
      }

      @media (max-width: 760px) {
        .review-grid,
        .diff,
        .facts,
        .diagnostic-facts,
        .batch {
          grid-template-columns: 1fr;
        }

        .batch legend,
        .batch .actions {
          grid-column: auto;
        }
      }
    `,
  ],
})
export class RpMechanicPanelComponent {
  readonly mode = input<RpMode>('roleplay');
  readonly profileOptions = input<readonly MechanicProfileOption[]>([]);
  readonly mechanicProfileId = input('');
  readonly activeRoleplaySessionId = input<string | undefined>(undefined);
  readonly activeMechanicSessionId = input<string | undefined>(undefined);
  readonly config = input<MechanicProfileConfig | null>(null);
  readonly sessions = input<readonly MechanicSessionSummary[]>([]);
  readonly proposals = input<readonly MechanicProposal[]>([]);
  readonly diagnostics = input<readonly MechanicDiagnostic[]>([]);
  readonly loading = input(false);
  readonly saving = input(false);
  readonly errorMessage = input<string | undefined>(undefined);

  readonly modeChange = output<RpMode>();
  readonly profileChange = output<string>();
  readonly configReload = output<void>();
  readonly configSave = output<MechanicProfileConfigWrite>();
  readonly refresh = output<void>();
  readonly sessionCreate = output<void>();
  readonly sessionSelect = output<string>();
  readonly sessionAttach = output<MechanicSessionAttachment>();
  readonly sessionArchive = output<string>();
  readonly sessionRestore = output<string>();
  readonly proposalApprove = output<MechanicProposalDecision>();
  readonly proposalReject = output<MechanicProposalDecision>();
  readonly proposalBatchApprove = output<MechanicProposalBatchDecision>();
  readonly proposalBatchReject = output<MechanicProposalBatchDecision>();
  readonly proposalApply = output<string>();
  readonly diagnosticOutcomeSave = output<MechanicDiagnosticOutcomeWrite>();

  protected readonly proposalKinds = MECHANIC_PROPOSAL_KINDS;
  protected readonly diagnosticOutcomes = MECHANIC_DIAGNOSTIC_OUTCOMES;
  protected readonly tabs: readonly {
    id: MechanicTab;
    label: string;
  }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'proposals', label: 'Proposals' },
    { id: 'diagnostics', label: 'Diagnostics' },
  ];

  protected readonly tab = signal<MechanicTab>('profile');
  protected readonly draftName = signal('');
  protected readonly draftProviderAlias = signal('');
  protected readonly sessionFilter = signal<SessionFilter>('active');
  protected readonly proposalFilter = signal<ProposalFilter>('all');
  protected readonly proposalKindFilter = signal<MechanicProposalKind | 'all'>(
    'all',
  );
  protected readonly selectedProposalId = signal<string | undefined>(undefined);
  protected readonly selectedProposalIds = signal<readonly string[]>([]);
  protected readonly reviewerId = signal('roleplay-user');
  protected readonly reviewNote = signal('');
  protected readonly diagnosticFilter = signal<DiagnosticFilter>('all');
  protected readonly diagnosticProposalFilter = signal('');
  protected readonly selectedDiagnosticId = signal<string | undefined>(
    undefined,
  );
  protected readonly diagnosticDraftOutcome = signal<
    MechanicDiagnosticOutcome | undefined
  >(undefined);
  protected readonly diagnosticDraftNotes = signal('');

  protected readonly visibleSessions = computed(() =>
    this.sessions().filter((session) => {
      const filter = this.sessionFilter();
      return (
        filter === 'all' ||
        (filter === 'archived' ? session.archived : !session.archived)
      );
    }),
  );

  protected readonly visibleProposals = computed(() =>
    this.proposals().filter((proposal) => {
      const status = this.proposalFilter();
      const kind = this.proposalKindFilter();
      return (
        (status === 'all' || proposal.status === status) &&
        (kind === 'all' || proposal.kind === kind)
      );
    }),
  );

  protected readonly selectedProposal = computed(() => {
    const visible = this.visibleProposals();
    const selected = this.selectedProposalId();
    return (
      visible.find((proposal) => proposal.proposalId === selected) ??
      visible[0] ??
      null
    );
  });

  protected readonly pendingProposalCount = computed(
    () =>
      this.proposals().filter((proposal) => proposal.status === 'proposed')
        .length,
  );

  protected readonly allVisiblePendingSelected = computed(() => {
    const pendingIds = this.visibleProposals()
      .filter((proposal) => proposal.status === 'proposed')
      .map((proposal) => proposal.proposalId);
    return (
      pendingIds.length > 0 &&
      pendingIds.every((proposalId) =>
        this.selectedProposalIds().includes(proposalId),
      )
    );
  });

  protected readonly visibleDiagnostics = computed(() => {
    const outcome = this.diagnosticFilter();
    const proposal = this.diagnosticProposalFilter().trim().toLowerCase();
    return this.diagnostics().filter(
      (diagnostic) =>
        (outcome === 'all' || diagnostic.outcome === outcome) &&
        (proposal === '' ||
          diagnostic.proposalIds.some((proposalId) =>
            proposalId.toLowerCase().includes(proposal),
          )),
    );
  });

  protected readonly selectedDiagnostic = computed(() => {
    const visible = this.visibleDiagnostics();
    const selected = this.selectedDiagnosticId();
    return (
      visible.find((diagnostic) => diagnostic.diagnosticId === selected) ??
      visible[0] ??
      null
    );
  });

  protected toggleMode(): void {
    const next = this.mode() === 'mechanic' ? 'roleplay' : 'mechanic';
    this.modeChange.emit(next);
    if (next === 'mechanic') this.tab.set('sessions');
  }

  protected selectProfile(event: Event): void {
    this.draftName.set('');
    this.draftProviderAlias.set('');
    this.profileChange.emit(this.inputValue(event));
  }

  protected saveConfig(event: Event, current: MechanicProfileConfig): void {
    event.preventDefault();
    const name = this.draftName().trim() || current.name;
    const providerAlias =
      this.draftProviderAlias().trim() || current.providerAlias;
    this.configSave.emit({
      name,
      ...(providerAlias !== undefined ? { providerAlias } : {}),
      autoMonitor: false,
    });
  }

  protected setSessionFilter(event: Event): void {
    const value = this.inputValue(event);
    if (value === 'active' || value === 'archived' || value === 'all') {
      this.sessionFilter.set(value);
    }
  }

  protected attachToActiveRoleplay(session: MechanicSessionSummary): void {
    const roleplaySessionId = this.activeRoleplaySessionId();
    if (roleplaySessionId === undefined) return;
    this.sessionAttach.emit({
      mechanicSessionId: session.association.mechanicSessionId,
      roleplaySessionId,
      expectedRevision: session.association.revision,
    });
  }

  protected setProposalFilter(event: Event): void {
    const value = this.inputValue(event);
    if (
      value === 'all' ||
      value === 'proposed' ||
      value === 'approved' ||
      value === 'rejected' ||
      value === 'applied'
    ) {
      this.proposalFilter.set(value);
    }
  }

  protected setProposalKindFilter(event: Event): void {
    const value = this.inputValue(event);
    if (value === 'all' || isProposalKind(value)) {
      this.proposalKindFilter.set(value);
    }
  }

  protected toggleProposal(proposalId: string, event: Event): void {
    const checked = this.inputChecked(event);
    this.selectedProposalIds.update((ids) =>
      checked
        ? [...ids.filter((id) => id !== proposalId), proposalId]
        : ids.filter((id) => id !== proposalId),
    );
  }

  protected toggleAllVisiblePending(event: Event): void {
    const pending = this.visibleProposals()
      .filter((proposal) => proposal.status === 'proposed')
      .map((proposal) => proposal.proposalId);
    if (this.inputChecked(event)) {
      this.selectedProposalIds.update((ids) => [
        ...new Set([...ids, ...pending]),
      ]);
    } else {
      this.selectedProposalIds.update((ids) =>
        ids.filter((id) => !pending.includes(id)),
      );
    }
  }

  protected decideOne(
    proposal: MechanicProposal,
    action: 'approve' | 'reject',
  ): void {
    const reviewerId = this.reviewerId().trim();
    if (reviewerId === '') return;
    const note = this.reviewNote().trim();
    const decision: MechanicProposalDecision = {
      proposalId: proposal.proposalId,
      reviewerId,
      expectedRevision: proposal.revision,
      ...(note !== '' ? { note } : {}),
    };
    if (action === 'approve') this.proposalApprove.emit(decision);
    else this.proposalReject.emit(decision);
  }

  protected decideBatch(action: 'approve' | 'reject'): void {
    const reviewerId = this.reviewerId().trim();
    if (reviewerId === '' || this.selectedProposalIds().length === 0) return;
    const note = this.reviewNote().trim();
    const decision: MechanicProposalBatchDecision = {
      proposalIds: this.selectedProposalIds(),
      reviewerId,
      ...(note !== '' ? { note } : {}),
    };
    if (action === 'approve') this.proposalBatchApprove.emit(decision);
    else this.proposalBatchReject.emit(decision);
    this.selectedProposalIds.set([]);
  }

  protected setDiagnosticFilter(event: Event): void {
    const value = this.inputValue(event);
    if (value === 'all' || isDiagnosticOutcome(value)) {
      this.diagnosticFilter.set(value);
    }
  }

  protected setDiagnosticDraftOutcome(event: Event): void {
    const value = this.inputValue(event);
    if (isDiagnosticOutcome(value)) this.diagnosticDraftOutcome.set(value);
  }

  protected saveDiagnosticOutcome(diagnostic: MechanicDiagnostic): void {
    const notes = this.diagnosticDraftNotes().trim();
    this.diagnosticOutcomeSave.emit({
      diagnosticId: diagnostic.diagnosticId,
      outcome: this.diagnosticDraftOutcome() ?? diagnostic.outcome,
      expectedRevision: diagnostic.revision,
      ...(notes !== '' ? { notes } : {}),
    });
  }

  protected openProposal(proposalId: string): void {
    this.proposalFilter.set('all');
    this.proposalKindFilter.set('all');
    this.selectedProposalId.set(proposalId);
    this.tab.set('proposals');
  }

  protected json(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2) ?? 'null';
    } catch {
      return String(value);
    }
  }

  protected shortId(value: string): string {
    return value.length <= 32
      ? value
      : `${value.slice(0, 16)}…${value.slice(-8)}`;
  }

  protected label(value: string): string {
    return value
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  protected inputValue(event: Event): string {
    return event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLTextAreaElement
      ? event.target.value
      : '';
  }

  private inputChecked(event: Event): boolean {
    return event.target instanceof HTMLInputElement
      ? event.target.checked
      : false;
  }
}

function isProposalKind(value: string): value is MechanicProposalKind {
  return MECHANIC_PROPOSAL_KINDS.some((kind) => kind === value);
}

function isDiagnosticOutcome(
  value: string,
): value is MechanicDiagnosticOutcome {
  return MECHANIC_DIAGNOSTIC_OUTCOMES.some((outcome) => outcome === value);
}
