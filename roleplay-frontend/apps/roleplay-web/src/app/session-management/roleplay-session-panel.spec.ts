import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { RpCharacter } from '@rusty-roleplay/rp-character-menu';
import type { LoreLayer } from '@rusty-roleplay/rp-lorebook';

import type { RoleplaySessionSummary } from './roleplay-session.model';
import { RoleplaySessionPanelComponent } from './roleplay-session-panel';

const SESSIONS: readonly RoleplaySessionSummary[] = [
  session({
    id: 'archived',
    archived: true,
    updatedAt: '2026-07-03T00:00:00Z',
  }),
  session({ id: 'active', archived: false, updatedAt: '2026-07-04T00:00:00Z' }),
];

const CHARACTERS: readonly RpCharacter[] = [
  {
    id: 'hero',
    name: 'Hero',
    description: 'Brave',
    personality: '',
    scenario: '',
    firstMessage: '',
    alternateGreetings: [],
    exampleMessages: [],
    tags: [],
    avatarUrl: undefined,
    status: 'active',
    createdAt: undefined,
    updatedAt: undefined,
  },
];

const LAYERS: readonly LoreLayer[] = [
  {
    layerId: 'world',
    profileId: 'profile-a',
    name: 'World',
    description: '',
    purpose: 'world',
    writePolicy: 'manual',
    archived: false,
    entryCount: 0,
    createdAt: undefined,
    updatedAt: undefined,
  },
];

describe('RoleplaySessionPanelComponent', () => {
  it('shows active sessions by default', () => {
    const fixture = createFixture();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('active');
    expect(text).not.toContain('archived');
  });

  it('emits create requests with character and layer selections', () => {
    const fixture = createFixture();
    const emitted: unknown[] = [];
    fixture.componentInstance.sessionCreate.subscribe((event) =>
      emitted.push(event),
    );

    fixture.nativeElement.querySelector('header button').click();
    fixture.detectChanges();
    selectValue(fixture.nativeElement.querySelector('.creator select'), 'hero');
    advance(fixture);
    const checkbox = fixture.nativeElement.querySelector(
      '.layer-list input',
    ) as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    advance(fixture);
    const name = fixture.nativeElement.querySelector(
      'input[name="displayName"]',
    ) as HTMLInputElement;
    name.value = 'New Session';
    name.dispatchEvent(new Event('input'));
    advance(fixture);
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));

    expect(emitted).toEqual([
      {
        displayName: 'New Session',
        characterId: 'hero',
        activeLayerIds: ['world'],
      },
    ]);
  });

  it('emits rename requests', () => {
    const fixture = createFixture();
    const emitted: unknown[] = [];
    fixture.componentInstance.sessionRename.subscribe((event) =>
      emitted.push(event),
    );

    fixture.nativeElement
      .querySelector('li .actions button')
      .dispatchEvent(new Event('click'));
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      'li .actions input',
    ) as HTMLInputElement;
    input.value = 'Renamed';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement
      .querySelector('li .actions button')
      .dispatchEvent(new Event('click'));

    expect(emitted).toEqual([{ sessionId: 'active', displayName: 'Renamed' }]);
  });
});

function createFixture() {
  const fixture = TestBed.createComponent(RoleplaySessionPanelComponent);
  fixture.componentRef.setInput('sessions', SESSIONS);
  fixture.componentRef.setInput('characters', CHARACTERS);
  fixture.componentRef.setInput('layers', LAYERS);
  fixture.componentRef.setInput('activeSessionId', 'active');
  fixture.detectChanges();
  return fixture;
}

function advance(fixture: ReturnType<typeof createFixture>): void {
  fixture.nativeElement
    .querySelector('.creator-actions button:last-child')
    .dispatchEvent(new Event('click'));
  fixture.detectChanges();
}

function selectValue(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

function session(input: {
  id: string;
  archived: boolean;
  updatedAt: string;
}): RoleplaySessionSummary {
  return {
    sessionId: input.id,
    profileId: 'profile-a',
    agentId: 'agent-a',
    status: input.archived ? 'archived' : 'idle',
    displayName: input.id,
    characterId: undefined,
    characterName: undefined,
    activeLayerIds: [],
    activeLayerCount: 0,
    lastMessagePreview: undefined,
    archived: input.archived,
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
  };
}
