import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { TopMenuController } from '@rusty-view/chat-shell';
import { TranscriptViewportComponent } from '@rusty-view/transcript-renderer';
import { describe, expect, it, vi } from 'vitest';

import { RpLayoutComponent } from './rp-layout';

describe('RpLayoutComponent', () => {
  it('opens the roleplay sessions panel from the scene label', () => {
    const openPanelId = signal<string | null>(null);
    const controller = {
      openPanelId: openPanelId.asReadonly(),
      openPanel: vi.fn((panelId: string) => openPanelId.set(panelId)),
      closePanel: vi.fn(() => openPanelId.set(null)),
      togglePanel: vi.fn((panelId: string) =>
        openPanelId.update((current) => (current === panelId ? null : panelId)),
      ),
    };
    TestBed.configureTestingModule({
      imports: [RpLayoutComponent],
      providers: [{ provide: TopMenuController, useValue: controller }],
    });
    const fixture = TestBed.createComponent(RpLayoutComponent);
    fixture.componentRef.setInput('messages', []);
    fixture.componentRef.setInput('sceneLabel', 'Moonlit Session');
    fixture.detectChanges();

    const scene = fixture.nativeElement.querySelector(
      'button.scene',
    ) as HTMLButtonElement;
    scene.click();

    expect(controller.openPanel).toHaveBeenCalledWith('rp-sessions');
  });

  it('defaults model activity hidden and exposes the shared visibility policy', () => {
    const openPanelId = signal<string | null>(null);
    TestBed.configureTestingModule({
      imports: [RpLayoutComponent],
      providers: [
        {
          provide: TopMenuController,
          useValue: {
            openPanelId: openPanelId.asReadonly(),
            openPanel: vi.fn(),
            closePanel: vi.fn(),
            togglePanel: vi.fn(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(RpLayoutComponent);
    fixture.componentRef.setInput('messages', []);
    fixture.detectChanges();

    const transcript = fixture.debugElement
      .query(By.directive(TranscriptViewportComponent))
      .injector.get(TranscriptViewportComponent);
    const toggle: unknown = fixture.nativeElement.querySelector(
      '[data-testid="model-activity-toggle"]',
    );
    if (!(toggle instanceof HTMLInputElement)) {
      throw new Error('Expected the model activity checkbox');
    }
    const changes: boolean[] = [];
    fixture.componentInstance.showModelActivityChange.subscribe((value) =>
      changes.push(value),
    );

    expect(toggle.checked).toBe(false);
    expect(transcript.activityVisibility()).toEqual({
      reasoning: false,
      tools: false,
    });

    toggle.click();
    expect(changes).toEqual([true]);

    fixture.componentRef.setInput('showModelActivity', true);
    fixture.detectChanges();
    expect(transcript.activityVisibility()).toEqual({
      reasoning: true,
      tools: true,
    });
  });
});
