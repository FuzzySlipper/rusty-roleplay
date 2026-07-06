import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TooltipDirective } from '@rusty-view/chat-components';

import { ContextUsageResponse } from './context-api';

export interface ContextSegment {
  readonly id: 'lore' | 'system' | 'history' | 'output' | 'remaining';
  readonly label: string;
  readonly tokens: number;
}

export interface ContextBreakdown {
  readonly totalTokens?: number | undefined;
  readonly usedTokens: number;
  readonly promptTokens: number;
  readonly safetyMarginTokens: number;
  readonly usableInputTokens?: number | undefined;
  readonly estimateQuality?: string | undefined;
  readonly estimateMethod?: string | undefined;
  readonly sampledMessageCount?: number | undefined;
  readonly providerLabel?: string | undefined;
  readonly segments: readonly ContextSegment[];
}

@Component({
  selector: 'app-context-breakdown',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  template: `
    <section class="context-panel" aria-labelledby="rp-context-title">
      <header class="context-panel__header">
        <div>
          <h3 id="rp-context-title">Context</h3>
          <p>{{ summaryText() }}</p>
        </div>
        <div class="context-panel__actions">
          <button
            type="button"
            class="icon-button"
            [disabled]="activeSessionId() === undefined || loading()"
            rvTooltip="Refresh the token estimate for the active session."
            (click)="refresh.emit()"
          >
            Refresh
          </button>
          <button
            type="button"
            class="icon-button"
            [disabled]="breakdown() === undefined"
            rvTooltip="Show or hide the context token categories."
            (click)="expanded.update(toggleBoolean)"
          >
            {{ expanded() ? 'Hide' : 'Details' }}
          </button>
        </div>
      </header>

      @if (activeSessionId() === undefined) {
        <p class="context-panel__state">Select or create a session to inspect its context budget.</p>
      } @else if (loading() && breakdown() === undefined) {
        <p class="context-panel__state">Loading context estimate...</p>
      } @else if (errorMessage() !== undefined) {
        <p class="context-panel__state context-panel__state--error">{{ errorMessage() }}</p>
      } @else if (breakdown(); as estimate) {
        <button
          type="button"
          class="context-summary"
          rvTooltip="Estimated prompt, response, and remaining token budget."
          (click)="expanded.update(toggleBoolean)"
        >
          <span>Context {{ contextReadout(estimate) }}</span>
          @if (estimate.totalTokens !== undefined) {
            <span>{{ usedPercent(estimate) }}%</span>
          }
        </button>
        <div class="token-bar" aria-hidden="true">
          @for (segment of estimate.segments; track segment.id) {
            <span
              class="token-bar__segment token-bar__segment--{{ segment.id }}"
              [style.flex-grow]="segment.tokens"
              [style.display]="segment.tokens > 0 ? 'block' : 'none'"
            ></span>
          }
        </div>

        @if (expanded()) {
          <dl class="context-details">
            @for (segment of estimate.segments; track segment.id) {
              <div>
                <dt>
                  <span class="swatch swatch--{{ segment.id }}"></span>
                  {{ segment.label }}
                </dt>
                <dd>{{ formatTokens(segment.tokens) }}</dd>
              </div>
            }
          </dl>
          <p class="context-footnote">
            @if (estimate.providerLabel !== undefined) {
              <span>{{ estimate.providerLabel }}.</span>
            }
            @if (estimate.estimateQuality !== undefined) {
              <span>{{ estimateSentence(estimate) }}</span>
            }
            @if (estimate.sampledMessageCount !== undefined) {
              <span>{{ estimate.sampledMessageCount }} messages sampled.</span>
            }
            @if (estimate.safetyMarginTokens > 0) {
              <span>{{ formatTokens(estimate.safetyMarginTokens) }} safety margin reserved.</span>
            }
          </p>
        }
      } @else {
        <p class="context-panel__state">No context estimate is available yet.</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-top: 16px;
    }

    .context-panel {
      border-top: 1px solid var(--rv-border-subtle, rgba(148, 163, 184, 0.28));
      color: var(--rv-foreground, #e5e7eb);
      padding-top: 14px;
    }

    .context-panel__header {
      align-items: flex-start;
      display: flex;
      gap: 12px;
      justify-content: space-between;
    }

    h3,
    p {
      margin: 0;
    }

    h3 {
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0;
    }

    p,
    .context-summary,
    .context-details,
    .context-footnote {
      font-size: 0.78rem;
    }

    .context-panel__header p,
    .context-panel__state,
    .context-footnote {
      color: var(--rv-muted-foreground, #94a3b8);
      line-height: 1.45;
      margin-top: 3px;
    }

    .context-panel__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
    }

    .icon-button,
    .context-summary {
      background: var(--rv-control-background, rgba(15, 23, 42, 0.72));
      border: 1px solid var(--rv-border-subtle, rgba(148, 163, 184, 0.3));
      border-radius: 6px;
      color: inherit;
      cursor: pointer;
      font: inherit;
    }

    .icon-button {
      min-height: 28px;
      padding: 4px 8px;
    }

    .icon-button:disabled {
      cursor: not-allowed;
      opacity: 0.56;
    }

    .context-summary {
      align-items: center;
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      min-height: 34px;
      padding: 7px 9px;
      text-align: left;
      width: 100%;
    }

    .token-bar {
      background: var(--rv-surface-subtle, rgba(15, 23, 42, 0.78));
      border-radius: 999px;
      display: flex;
      height: 8px;
      margin-top: 8px;
      overflow: hidden;
      width: 100%;
    }

    .token-bar__segment {
      min-width: 2px;
    }

    .token-bar__segment--lore,
    .swatch--lore {
      background: #0f766e;
    }

    .token-bar__segment--system,
    .swatch--system {
      background: #4f46e5;
    }

    .token-bar__segment--history,
    .swatch--history {
      background: #2563eb;
    }

    .token-bar__segment--output,
    .swatch--output {
      background: #b45309;
    }

    .token-bar__segment--remaining,
    .swatch--remaining {
      background: #16a34a;
    }

    .context-details {
      display: grid;
      gap: 7px;
      margin: 12px 0 0;
    }

    .context-details div {
      align-items: center;
      display: flex;
      justify-content: space-between;
      min-height: 22px;
    }

    dt {
      align-items: center;
      color: var(--rv-muted-foreground, #94a3b8);
      display: inline-flex;
      gap: 7px;
    }

    dd {
      font-variant-numeric: tabular-nums;
      margin: 0;
    }

    .swatch {
      border-radius: 999px;
      display: inline-block;
      height: 8px;
      width: 8px;
    }

    .context-panel__state {
      margin-top: 12px;
    }

    .context-panel__state--error {
      color: var(--rv-danger, #f87171);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextBreakdownComponent {
  readonly usage = input<ContextUsageResponse | null>(null);
  readonly activeSessionId = input<string | undefined>(undefined);
  readonly loading = input(false);
  readonly errorMessage = input<string | undefined>(undefined);
  readonly refresh = output<void>();

  protected readonly expanded = signal(false);
  protected readonly breakdown = computed(() => buildContextBreakdown(this.usage()));
  protected readonly summaryText = computed(() => {
    const estimate = this.breakdown();
    if (this.loading() && estimate !== undefined) {
      return 'Refreshing estimate...';
    }
    if (estimate === undefined) {
      return 'Prompt, response, and remaining budget.';
    }
    if (estimate.totalTokens === undefined) {
      return `${formatTokens(estimate.usedTokens)} estimated tokens in context.`;
    }
    return `${formatTokens(estimate.usedTokens)} of ${formatTokens(estimate.totalTokens)} tokens reserved or used.`;
  });
  protected readonly toggleBoolean = (value: boolean): boolean => !value;

  protected formatTokens(value: number): string {
    return formatTokens(value);
  }

  protected usedPercent(estimate: ContextBreakdown): number {
    if (estimate.totalTokens === undefined || estimate.totalTokens <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((estimate.usedTokens / estimate.totalTokens) * 100));
  }

  protected contextReadout(estimate: ContextBreakdown): string {
    const used = formatTokens(estimate.usedTokens);
    return estimate.totalTokens === undefined ? used : `${used}/${formatTokens(estimate.totalTokens)}`;
  }

  protected estimateSentence(estimate: ContextBreakdown): string {
    return estimate.estimateMethod === undefined
      ? `${estimate.estimateQuality} estimate.`
      : `${estimate.estimateQuality} estimate via ${estimate.estimateMethod}.`;
  }
}

export function buildContextBreakdown(usage: ContextUsageResponse | null | undefined): ContextBreakdown | undefined {
  if (usage === null || usage === undefined) {
    return undefined;
  }

  const context = usage.context;
  const totalTokens = context.contextWindowTokens ?? usage.provider?.contextWindowTokens;
  const outputTokens = context.reservedResponseTokens ?? context.maxOutputTokens ?? usage.provider?.maxOutputTokens ?? 0;
  const safetyMarginTokens = context.safetyMarginTokens ?? 0;
  const promptTokens =
    context.estimatedPromptTokens ??
    (totalTokens !== undefined && context.estimatedRemainingTokens !== undefined
      ? Math.max(0, totalTokens - context.estimatedRemainingTokens)
      : 0);
  const loreTokens = context.loreTokens ?? 0;
  const systemTokens = context.systemTokens ?? 0;
  const historyTokens = context.historyTokens ?? Math.max(0, promptTokens - loreTokens - systemTokens);
  const promptRemainder = Math.max(0, promptTokens - loreTokens - systemTokens - historyTokens);
  const normalizedHistoryTokens = historyTokens + promptRemainder;
  const remainingTokens =
    totalTokens === undefined
      ? context.estimatedRemainingTokens ?? 0
      : Math.max(0, totalTokens - loreTokens - systemTokens - normalizedHistoryTokens - outputTokens - safetyMarginTokens);

  return {
    totalTokens,
    usedTokens: loreTokens + systemTokens + normalizedHistoryTokens + outputTokens,
    promptTokens,
    safetyMarginTokens,
    usableInputTokens: context.usableInputTokens,
    estimateQuality: context.estimateQuality,
    estimateMethod: context.estimateMethod,
    sampledMessageCount: context.sampledMessageCount,
    providerLabel: providerLabel(usage),
    segments: [
      { id: 'lore', label: 'Lore', tokens: loreTokens },
      { id: 'system', label: 'System', tokens: systemTokens },
      { id: 'history', label: 'History', tokens: normalizedHistoryTokens },
      { id: 'output', label: 'Output reserve', tokens: outputTokens },
      { id: 'remaining', label: 'Remaining', tokens: remainingTokens },
    ],
  };
}

function providerLabel(usage: ContextUsageResponse): string | undefined {
  const displayName = usage.provider?.displayName;
  const modelId = usage.provider?.modelId;
  if (displayName !== undefined && modelId !== undefined) {
    return `${displayName} ${modelId}`;
  }
  return displayName ?? modelId;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${trimNumber(value / 1_000_000)}m`;
  }
  if (value >= 1_000) {
    return `${trimNumber(value / 1_000)}k`;
  }
  return value.toLocaleString('en-US');
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}
