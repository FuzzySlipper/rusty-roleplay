import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import type { FirstNarratorSetupRequest } from './profile-registry-api';

interface FirstNarratorDraft {
  readonly profileId: string;
  readonly displayName: string;
  readonly providerAlias: string;
  readonly providerDisplayName: string;
  readonly providerBaseUrl: string;
  readonly modelId: string;
  readonly contextWindowTokens: string;
  readonly maxOutputTokens: string;
  readonly apiKey: string;
}

type FirstNarratorTextField = keyof FirstNarratorDraft;

const EMPTY_DRAFT: FirstNarratorDraft = {
  profileId: '',
  displayName: '',
  providerAlias: '',
  providerDisplayName: '',
  providerBaseUrl: '',
  modelId: '',
  contextWindowTokens: '',
  maxOutputTokens: '',
  apiKey: '',
};

@Component({
  selector: 'app-first-narrator-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="setup" aria-labelledby="first-narrator-title">
      <h2 id="first-narrator-title">Create the first narrator</h2>
      <p>
        This Rusty Crew database has no Roleplay narrator yet. Add its
        OpenAI-compatible model provider and narrator profile to unlock RP
        Setup, ST Import, lore, and chat.
      </p>

      @if (errorMessage(); as error) {
        <p class="error" role="alert">{{ error }}</p>
      }

      <form (submit)="submit($event)">
        <fieldset [disabled]="saving()">
          <legend>Narrator profile</legend>
          <label>
            Display name
            <input
              name="displayName"
              autocomplete="off"
              required
              [value]="draft().displayName"
              (input)="update('displayName', $event)"
            />
          </label>
          <label>
            Profile ID
            <input
              name="profileId"
              autocomplete="off"
              required
              placeholder="roleplay"
              [value]="draft().profileId"
              (input)="update('profileId', $event)"
            />
          </label>
        </fieldset>

        <fieldset [disabled]="saving()">
          <legend>Model provider</legend>
          <label>
            Provider name
            <input
              name="providerDisplayName"
              autocomplete="off"
              required
              [value]="draft().providerDisplayName"
              (input)="update('providerDisplayName', $event)"
            />
          </label>
          <label>
            Provider alias
            <input
              name="providerAlias"
              autocomplete="off"
              required
              placeholder="roleplay-router"
              [value]="draft().providerAlias"
              (input)="update('providerAlias', $event)"
            />
          </label>
          <label class="wide">
            Base URL
            <input
              name="providerBaseUrl"
              type="url"
              required
              placeholder="https://provider.example/v1"
              [value]="draft().providerBaseUrl"
              (input)="update('providerBaseUrl', $event)"
            />
          </label>
          <label>
            Model ID
            <input
              name="modelId"
              autocomplete="off"
              required
              [value]="draft().modelId"
              (input)="update('modelId', $event)"
            />
          </label>
          <label>
            Context window tokens
            <input
              name="contextWindowTokens"
              type="number"
              min="1"
              step="1"
              required
              [value]="draft().contextWindowTokens"
              (input)="update('contextWindowTokens', $event)"
            />
          </label>
          <label>
            Maximum output tokens
            <input
              name="maxOutputTokens"
              type="number"
              min="1"
              step="1"
              required
              [value]="draft().maxOutputTokens"
              (input)="update('maxOutputTokens', $event)"
            />
          </label>
          <label class="wide">
            API key (optional for local gateways)
            <input
              name="apiKey"
              type="password"
              autocomplete="new-password"
              [value]="draft().apiKey"
              (input)="update('apiKey', $event)"
            />
          </label>
        </fieldset>

        <div class="actions">
          <button type="submit" [disabled]="saving() || !valid()">
            {{ saving() ? 'Creating narrator…' : 'Create narrator' }}
          </button>
          <button type="button" [disabled]="saving()" (click)="retry.emit()">
            Check again
          </button>
        </div>
      </form>
    </section>
  `,
  styles: [
    `
      .setup {
        background: var(--rv-color-surface-raised, #20242b);
        border: 1px solid var(--rv-color-border-subtle, #4b5563);
        border-radius: 12px;
        display: grid;
        gap: 1rem;
        max-width: 48rem;
        padding: 1.25rem;
        text-align: left;
        width: min(100%, 48rem);
      }

      h2,
      p {
        margin: 0;
      }

      p {
        color: var(--rv-color-text-muted, #9ca3af);
      }

      .error {
        color: var(--rv-color-danger, #f87171);
      }

      form,
      fieldset {
        display: grid;
        gap: 0.85rem;
      }

      fieldset {
        border: 0;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin: 0;
        padding: 0;
      }

      legend {
        font-weight: 700;
        grid-column: 1 / -1;
        margin-bottom: 0.25rem;
      }

      label {
        display: grid;
        gap: 0.35rem;
      }

      .wide {
        grid-column: 1 / -1;
      }

      input {
        background: var(--rv-color-surface-base, #111318);
        border: 1px solid var(--rv-color-border-subtle, #4b5563);
        border-radius: 6px;
        color: inherit;
        min-width: 0;
        padding: 0.55rem 0.65rem;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
      }

      button {
        background: var(--rv-color-surface-raised, #20242b);
        border: 1px solid var(--rv-color-border-subtle, #4b5563);
        border-radius: 6px;
        color: inherit;
        cursor: pointer;
        padding: 0.55rem 0.8rem;
      }

      button[type='submit'] {
        background: var(--rv-color-accent, #2563eb);
        border-color: transparent;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      @media (max-width: 42rem) {
        fieldset {
          grid-template-columns: 1fr;
        }

        .wide {
          grid-column: auto;
        }
      }
    `,
  ],
})
export class FirstNarratorSetupComponent {
  readonly errorMessage = input<string | undefined>(undefined);
  readonly saving = input(false);
  readonly narratorCreate = output<FirstNarratorSetupRequest>();
  readonly retry = output<void>();

  protected readonly draft = signal<FirstNarratorDraft>(EMPTY_DRAFT);
  protected readonly valid = computed(
    () => requestFromDraft(this.draft()) !== null,
  );

  protected update(field: FirstNarratorTextField, event: Event): void {
    const target = event.target;
    const value = target instanceof HTMLInputElement ? target.value : '';
    this.draft.update((current) => ({ ...current, [field]: value }));
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const request = requestFromDraft(this.draft());
    if (request !== null) {
      this.narratorCreate.emit(request);
    }
  }
}

export function requestFromDraft(
  draft: FirstNarratorDraft,
): FirstNarratorSetupRequest | null {
  const contextWindowTokens = positiveInteger(draft.contextWindowTokens);
  const maxOutputTokens = positiveInteger(draft.maxOutputTokens);
  const requiredText = [
    draft.profileId,
    draft.displayName,
    draft.providerAlias,
    draft.providerDisplayName,
    draft.providerBaseUrl,
    draft.modelId,
  ];
  if (
    requiredText.some((value) => value.trim().length === 0) ||
    contextWindowTokens === null ||
    maxOutputTokens === null
  ) {
    return null;
  }

  const apiKey = draft.apiKey.trim();
  return {
    profileId: draft.profileId.trim(),
    displayName: draft.displayName.trim(),
    providerAlias: draft.providerAlias.trim(),
    providerDisplayName: draft.providerDisplayName.trim(),
    providerBaseUrl: draft.providerBaseUrl.trim().replace(/\/+$/, ''),
    modelId: draft.modelId.trim(),
    contextWindowTokens,
    maxOutputTokens,
    apiKey: apiKey.length === 0 ? undefined : apiKey,
  };
}

function positiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
