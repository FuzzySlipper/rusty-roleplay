import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TopMenuController } from '@rusty-view/chat-shell';
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
        openPanelId.update((current) =>
          current === panelId ? null : panelId,
        ),
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
});
