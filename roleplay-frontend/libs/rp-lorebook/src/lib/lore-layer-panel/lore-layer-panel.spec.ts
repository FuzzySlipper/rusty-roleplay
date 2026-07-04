import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { ChatLoreLayer } from '../lore-layer.model';
import { LoreLayerPanelComponent } from './lore-layer-panel';

const LAYERS: readonly ChatLoreLayer[] = [
  {
    layerId: 'world',
    profileId: 'profile-a',
    name: 'World',
    description: 'Permanent facts',
    purpose: 'world',
    writePolicy: 'manual',
    archived: false,
    entryCount: 4,
    createdAt: undefined,
    updatedAt: undefined,
    enabled: true,
    priority: 0,
  },
  {
    layerId: 'capture',
    profileId: 'profile-a',
    name: 'Capture',
    description: '',
    purpose: 'story',
    writePolicy: 'auto_capture',
    archived: false,
    entryCount: 1,
    createdAt: undefined,
    updatedAt: undefined,
    enabled: false,
    priority: 1,
  },
];

describe('LoreLayerPanelComponent', () => {
  it('renders layer names, badges, and active count', () => {
    const fixture = TestBed.createComponent(LoreLayerPanelComponent);
    fixture.componentRef.setInput('layers', LAYERS);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('World');
    expect(text).toContain('auto_capture');
    expect(text).toContain('1 active');
  });

  it('emits toggle events', () => {
    const fixture = TestBed.createComponent(LoreLayerPanelComponent);
    fixture.componentRef.setInput('layers', LAYERS);
    const events: unknown[] = [];
    fixture.componentInstance.layerToggle.subscribe((event) =>
      events.push(event),
    );
    fixture.detectChanges();

    const checkbox = fixture.nativeElement.querySelectorAll(
      'input[type="checkbox"]',
    )[1] as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    expect(events).toEqual([{ layerId: 'capture', enabled: true }]);
  });

  it('shows loading state before rows', () => {
    const fixture = TestBed.createComponent(LoreLayerPanelComponent);
    fixture.componentRef.setInput('layers', LAYERS);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading layers...');
  });
});
