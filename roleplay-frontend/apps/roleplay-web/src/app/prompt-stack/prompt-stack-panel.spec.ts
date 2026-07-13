import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { RoleplayWorkbench } from '../roleplay-workbench';
import {
  PromptStackApi,
  type PromptStackPreview,
} from './prompt-stack-api';
import { PromptStackPanelComponent } from './prompt-stack-panel';

describe('PromptStackPanelComponent', () => {
  it('renders prompt sections and source trace for the active session', async () => {
    const preview = promptStackPreview();
    const readPromptStack = vi.fn().mockResolvedValue(preview);
    const fixture = await render({
      activeSessionId: 'session-a',
      readPromptStack,
    });

    clickButton(fixture.nativeElement, 'Refresh');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(readPromptStack).toHaveBeenCalledWith('session-a');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('1 sections, 1 trace rows, 1 imported prompt blocks');
    expect(text).toContain('Core Behavior');
    expect(text).toContain('Keep prose clean.');
    expect(text).toContain('base roleplay runtime guidance');
    expect(text).toContain('roleplay_runtime / session-a');
  });

  it('shows raw compiled prompt text on request', async () => {
    const fixture = await render({
      activeSessionId: 'session-a',
      readPromptStack: vi.fn().mockResolvedValue(promptStackPreview()),
    });

    clickButton(fixture.nativeElement, 'Refresh');
    await fixture.whenStable();
    fixture.detectChanges();
    clickButton(fixture.nativeElement, 'Raw');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('pre')?.textContent).toContain(
      '# Compiled prompt',
    );
  });

  it('shows the empty state when no session is selected', async () => {
    const fixture = await render({
      activeSessionId: undefined,
      readPromptStack: vi.fn(),
    });

    expect(fixture.nativeElement.textContent).toContain(
      'Select a session to inspect its prompt stack.',
    );
    expect(button(fixture.nativeElement, 'Refresh').disabled).toBe(true);
  });

  it('shows request errors without keeping the loading state active', async () => {
    const fixture = await render({
      activeSessionId: 'session-a',
      readPromptStack: vi.fn().mockRejectedValue(new Error('Preview failed')),
    });

    clickButton(fixture.nativeElement, 'Refresh');
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Preview failed');
    expect(text).not.toContain('Loading prompt stack');
  });
});

async function render(input: {
  activeSessionId: string | undefined;
  readPromptStack: (sessionId: string) => Promise<PromptStackPreview>;
}) {
  TestBed.resetTestingModule();
  const activeSessionId = signal(input.activeSessionId);
  await TestBed.configureTestingModule({
    imports: [PromptStackPanelComponent],
    providers: [
      {
        provide: RoleplayWorkbench,
        useValue: {
          chatStore: {
            activeSessionId,
          },
        },
      },
      {
        provide: PromptStackApi,
        useValue: {
          readPromptStack: input.readPromptStack,
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(PromptStackPanelComponent);
  fixture.detectChanges();
  return fixture;
}

function promptStackPreview(): PromptStackPreview {
  return {
    sessionId: 'session-a',
    profileId: 'profile-a',
    promptContext: '# Prompt context',
    compiledText: '# Compiled prompt',
    sections: [
      {
        id: 'core_behavior',
        title: 'Core Behavior',
        body: 'Keep prose clean.',
        sourceKind: 'roleplay_runtime',
        sourceId: 'session-a',
        inclusionReason: 'base roleplay runtime guidance',
        tokenEstimate: 12,
        editable: false,
        derived: true,
      },
    ],
    trace: [
      {
        sectionId: 'core_behavior',
        sourceKind: 'roleplay_runtime',
        sourceId: 'session-a',
        inclusionReason: 'base roleplay runtime guidance',
        tokenEstimate: 12,
        editable: false,
        derived: true,
      },
    ],
    macroResolutions: [],
    importedPromptBlockCount: 1,
  };
}

function clickButton(host: HTMLElement, label: string): void {
  button(host, label).click();
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(host.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!(found instanceof HTMLButtonElement)) {
    throw new Error(`Button ${label} was not found.`);
  }
  return found;
}
