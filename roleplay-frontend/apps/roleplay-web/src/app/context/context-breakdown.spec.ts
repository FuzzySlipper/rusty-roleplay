import { ComponentFixture, TestBed } from '@angular/core/testing';

import { buildContextBreakdown, ContextBreakdownComponent } from './context-breakdown';

describe('buildContextBreakdown', () => {
  it('renders explicit lore, system, history, output, and remaining segments', () => {
    const breakdown = buildContextBreakdown({
      sessionId: 'session-1',
      provider: { contextWindowTokens: 20000, maxOutputTokens: 1000 },
      context: {
        estimatedPromptTokens: 5000,
        loreTokens: 800,
        systemTokens: 1200,
        historyTokens: 3000,
        reservedResponseTokens: 1000,
        safetyMarginTokens: 500,
      },
    });

    expect(breakdown?.usedTokens).toBe(6000);
    expect(breakdown?.segments.map((segment) => [segment.id, segment.tokens])).toEqual([
      ['lore', 800],
      ['system', 1200],
      ['history', 3000],
      ['output', 1000],
      ['remaining', 13500],
    ]);
  });

  it('falls back to aggregate prompt tokens as history when segment detail is absent', () => {
    const breakdown = buildContextBreakdown({
      sessionId: 'session-1',
      provider: { contextWindowTokens: 10000 },
      context: {
        estimatedPromptTokens: 2500,
        reservedResponseTokens: 1000,
      },
    });

    expect(breakdown?.segments.find((segment) => segment.id === 'history')?.tokens).toBe(2500);
    expect(breakdown?.segments.find((segment) => segment.id === 'remaining')?.tokens).toBe(6500);
  });

  it('handles zero and empty estimates', () => {
    const breakdown = buildContextBreakdown({
      sessionId: 'session-1',
      context: {},
    });

    expect(breakdown?.usedTokens).toBe(0);
    expect(breakdown?.segments.every((segment) => segment.tokens === 0)).toBe(true);
  });
});

describe('ContextBreakdownComponent', () => {
  let fixture: ComponentFixture<ContextBreakdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContextBreakdownComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContextBreakdownComponent);
  });

  it('shows an empty state when no session is active', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Select or create a session');
  });

  it('shows the context readout and can expand the category rows', () => {
    fixture.componentRef.setInput('activeSessionId', 'session-1');
    fixture.componentRef.setInput('usage', {
      sessionId: 'session-1',
      provider: { contextWindowTokens: 20000 },
      context: {
        estimatedPromptTokens: 5000,
        reservedResponseTokens: 1000,
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Context 6k/20k');
    fixture.nativeElement.querySelector('.context-summary').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('History');
    expect(fixture.nativeElement.textContent).toContain('Remaining');
  });
});
