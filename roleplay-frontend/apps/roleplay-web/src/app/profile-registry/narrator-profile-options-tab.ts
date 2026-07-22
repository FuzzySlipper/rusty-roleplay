import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { RoleplayWorkbench } from '../roleplay-workbench';

/** Options tab for choosing the active Roleplay narrator runtime profile. */
@Component({
  selector: 'app-narrator-profile-options-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="narrator-profile-options">
      <header>
        <h3>Narrator profile</h3>
        <p>
          Choose the Rusty Crew configuration that narrates this roleplay. This
          is not a user account or character persona.
        </p>
      </header>

      <label>
        Active narrator
        <select
          [value]="workbench.activeProfile()?.id ?? ''"
          [disabled]="
            workbench.profilesLoading() ||
            workbench.profileSwitching() ||
            workbench.narratorProfiles().length < 2
          "
          (change)="selectProfile($event)"
        >
          @for (profile of workbench.narratorProfiles(); track profile.id) {
            <option [value]="profile.id">{{ profile.name }}</option>
          }
        </select>
      </label>

      @if (workbench.profileSwitching()) {
        <p class="state" role="status">Switching narrator profile…</p>
      } @else if (workbench.narratorProfiles().length < 2) {
        <p class="state">
          No other Roleplay narrator profiles are currently available.
        </p>
      }

      @if (workbench.selectError(); as error) {
        <p class="state error" role="alert">{{ error }}</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      padding: var(--rv-space-lg, 1rem);
    }

    .narrator-profile-options {
      display: grid;
      gap: var(--rv-space-lg, 1rem);
      max-width: 38rem;
    }

    header,
    header h3,
    header p,
    .state {
      margin: 0;
    }

    header {
      display: grid;
      gap: var(--rv-space-xs, 0.35rem);
    }

    header p,
    .state {
      color: var(--rv-color-text-muted, #9ca3af);
      line-height: 1.45;
    }

    label {
      color: var(--rv-color-text-secondary, #d1d5db);
      display: grid;
      font-size: 0.9rem;
      font-weight: 600;
      gap: var(--rv-space-xs, 0.35rem);
    }

    select {
      background: var(--rv-color-surface-raised, #20242b);
      border: 1px solid var(--rv-color-border, #4b5563);
      border-radius: var(--rv-radius-sm, 6px);
      color: var(--rv-color-text-primary, #f3f4f6);
      font: inherit;
      max-width: 24rem;
      padding: 0.55rem 0.65rem;
    }

    select:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }

    .error {
      color: var(--rv-color-danger, #f87171);
    }
  `,
})
export class NarratorProfileOptionsTabComponent {
  protected readonly workbench = inject(RoleplayWorkbench);

  protected selectProfile(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    this.workbench.switchNarratorProfile(target.value);
  }
}
