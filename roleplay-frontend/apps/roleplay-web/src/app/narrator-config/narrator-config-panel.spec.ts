import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { NarratorConfigPanelComponent } from './narrator-config-panel';
import {
  buildNarratorStylePrompt,
  type NarratorConfig,
} from './narrator-config.model';

@Component({
  imports: [NarratorConfigPanelComponent],
  template: `
    <app-narrator-config-panel
      [config]="config"
      (configSave)="saved = $event"
    />
  `,
})
class HostComponent {
  config: NarratorConfig = {
    tone: 'lush',
    pacing: 'balanced',
    explicitness: 'romantic',
    memoryDepth: 'medium',
    exemplar: 'Flowing prose.',
    review: {
      enabled: false,
      maxReviewCycles: 1,
      checkGravityDrift: true,
      checkCharacterVoice: true,
      checkContinuity: true,
    },
  };
  saved: NarratorConfig | undefined;
}

describe('NarratorConfigPanelComponent', () => {
  it('edits and emits narrator config', async () => {
    const fixture = await render();
    const host = fixture.componentInstance;
    const selects = fixture.nativeElement.querySelectorAll('select');
    const reviewEnabled = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;

    selects[0].value = 'wry';
    selects[0].dispatchEvent(new Event('change'));
    reviewEnabled.checked = true;
    reviewEnabled.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(host.saved?.tone).toBe('wry');
    expect(host.saved?.review.enabled).toBe(true);
  });

  it('generates an editable style prompt from the controls', async () => {
    const fixture = await render({ exemplar: '' });
    const host = fixture.componentInstance;
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const selects = fixture.nativeElement.querySelectorAll('select');
    const textarea = fixture.nativeElement.querySelector(
      'textarea',
    ) as HTMLTextAreaElement;
    const rebuild = findButton(fixture.nativeElement, 'Rebuild prompt');

    expect(textarea.value).toContain('Narrator style prompt:');

    textarea.value = 'Custom narrator prompt.';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    rebuild.click();
    fixture.detectChanges();

    expect(textarea.value).toBe(buildNarratorStylePrompt(host.config));

    selects[0].value = 'wry';
    selects[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(host.saved?.tone).toBe('wry');
    expect(host.saved?.exemplar).toContain('dry humor');
  });

  it('uses a clearer review-before-sending label', async () => {
    const fixture = await render();

    expect(fixture.nativeElement.textContent).toContain(
      'Review before final answer',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Run narrator review pass before sending',
    );
  });
});

async function render(
  configPatch: Partial<NarratorConfig> = {},
): Promise<ComponentFixture<HostComponent>> {
  await TestBed.configureTestingModule({
    imports: [HostComponent],
  }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.config = {
    ...fixture.componentInstance.config,
    ...configPatch,
  };
  fixture.detectChanges();
  return fixture;
}

function findButton(host: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button ${label} was not found.`);
  }
  return button;
}
