import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type {
  MechanicProfileConfig,
  MechanicProposal,
  MechanicProposalBatchDecision,
} from '../mechanic.model';
import { RpMechanicPanelComponent } from './rp-mechanic';

const CONFIG: MechanicProfileConfig = {
  profileId: 'mechanic',
  configured: true,
  name: 'Maren',
  providerAlias: 'deepseek-flash',
  autoMonitor: {
    enabled: false,
    available: false,
    status: 'inactive_future',
  },
  localToolProfileId: 'roleplay_mechanic',
  toolPolicyIsolated: true,
  applies: 'next_wake',
};

const PROPOSALS: readonly MechanicProposal[] = [
  {
    proposalId: 'p1',
    mechanicSessionId: 'mechanic-session',
    roleplaySessionId: 'rp-session',
    profileId: 'narrator',
    kind: 'exemplar',
    beforeValue: 'Abrupt scenes.',
    proposedValue: 'Patient scenes.',
    rationale: 'Scene transitions skip established beats.',
    diagnosticContext: {},
    status: 'proposed',
    revision: 1,
    history: [],
    createdAt: '2026-07-13T00:00:00Z',
    updatedAt: '2026-07-13T00:00:00Z',
  },
];

describe('RpMechanicPanelComponent', () => {
  it('toggles into a visually distinct mechanic mode through the output', () => {
    const fixture = TestBed.createComponent(RpMechanicPanelComponent);
    fixture.componentRef.setInput('mode', 'roleplay');
    fixture.detectChanges();

    let next: string | undefined;
    fixture.componentInstance.modeChange.subscribe((mode) => (next = mode));
    fixture.nativeElement.querySelector('.mode-toggle').click();

    expect(next).toBe('mechanic');
    fixture.componentRef.setInput('mode', 'mechanic');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.mechanic-mode'),
    ).not.toBeNull();
  });

  it('emits typed mechanic profile settings without enabling future monitoring', () => {
    const fixture = TestBed.createComponent(RpMechanicPanelComponent);
    fixture.componentRef.setInput('mechanicProfileId', 'mechanic');
    fixture.componentRef.setInput('config', CONFIG);
    fixture.detectChanges();

    let saved: unknown;
    fixture.componentInstance.configSave.subscribe((value) => (saved = value));
    const name = fixture.nativeElement.querySelector(
      'input[name="mechanicName"]',
    ) as HTMLInputElement;
    name.value = 'Quinn';
    name.dispatchEvent(new Event('input'));
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));

    expect(saved).toEqual({
      name: 'Quinn',
      providerAlias: 'deepseek-flash',
      autoMonitor: false,
    });
  });

  it('supports selecting and approving pending proposals as a batch', () => {
    const fixture = TestBed.createComponent(RpMechanicPanelComponent);
    fixture.componentRef.setInput('proposals', PROPOSALS);
    fixture.detectChanges();
    const proposalTab = [
      ...fixture.nativeElement.querySelectorAll('.tabs button'),
    ].find((button) => button.textContent.includes('Proposals')) as HTMLElement;
    proposalTab.click();
    fixture.detectChanges();

    const checkbox = fixture.nativeElement.querySelector(
      'input[aria-label="Select p1"]',
    ) as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    let batch: MechanicProposalBatchDecision | undefined;
    fixture.componentInstance.proposalBatchApprove.subscribe(
      (value) => (batch = value),
    );
    const approve = [
      ...fixture.nativeElement.querySelectorAll('.batch button'),
    ].find((button) =>
      button.textContent.includes('Approve selected'),
    ) as HTMLElement;
    approve.click();

    expect(batch).toEqual({
      proposalIds: ['p1'],
      reviewerId: 'roleplay-user',
    });
  });
});
