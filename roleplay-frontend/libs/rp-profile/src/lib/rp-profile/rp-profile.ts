import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import { Profile } from '../profile.model';

/** Emitted when the user chooses a profile to enter. */
export interface ProfileSelection {
  readonly profileId: string;
  readonly password: string | undefined;
}

/**
 * Presentational profile selector shown on app startup. Receives the profile
 * list via input and emits a selection; it injects no services. The container
 * (the app shell) wires this to ProfileStore and surfaces auth errors.
 */
@Component({
  selector: 'rp-profile-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rp-profile-selector">
      <h1>Choose a profile</h1>
      <ul class="profiles">
        @for (profile of profiles(); track profile.id) {
          <li>
            <button
              type="button"
              class="profile"
              [class.selected]="profile.id === focusedId()"
              (click)="focus(profile)"
            >
              <span class="name">{{ profile.name }}</span>
              @if (profile.hasPassword) {
                <span class="lock" aria-label="password protected">🔒</span>
              }
            </button>
          </li>
        }
      </ul>

      @if (focused(); as profile) {
        <form class="enter" (submit)="submit($event)">
          @if (profile.hasPassword) {
            <label>
              Password
              <input type="password" name="password" autocomplete="off" />
            </label>
          }
          <button type="submit">Enter as {{ profile.name }}</button>
          @if (errorMessage(); as message) {
            <p class="error" role="alert">{{ message }}</p>
          }
        </form>
      }
    </section>
  `,
  styles: [
    `
      .rp-profile-selector {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-width: 24rem;
        margin: 4rem auto;
      }
      .profiles {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .profile {
        display: flex;
        justify-content: space-between;
        width: 100%;
        padding: 0.75rem 1rem;
        cursor: pointer;
      }
      .profile.selected {
        outline: 2px solid currentColor;
      }
      .enter {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .error {
        color: #b00020;
        margin: 0;
      }
    `,
  ],
})
export class RpProfileSelectorComponent {
  readonly profiles = input.required<readonly Profile[]>();
  /** Set by the container when a selection attempt fails. */
  readonly errorMessage = input<string | undefined>(undefined);

  readonly selectProfile = output<ProfileSelection>();

  protected readonly focusedId = signal<string | null>(null);
  protected readonly focused = computed<Profile | null>(
    () => this.profiles().find((p) => p.id === this.focusedId()) ?? null,
  );

  protected focus(profile: Profile): void {
    this.focusedId.set(profile.id);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const profile = this.focused();
    if (!profile) {
      return;
    }
    const form = event.target as HTMLFormElement;
    const field = form.elements.namedItem('password');
    const password =
      field instanceof HTMLInputElement && field.value
        ? field.value
        : undefined;
    this.selectProfile.emit({ profileId: profile.id, password });
  }
}
