import { expect, test } from '@playwright/test';

import {
  evaluateStExampleLongChat,
  evaluateStExampleTurn,
  type StExampleTurnEvidence,
} from './st-example-evaluation';

const dreamPlanet = 'st-lore:The-Dream-Planet';

test('ST outcome rubric scores lore-aware clean prose without requiring exact text', () => {
  const evidence = fixtureTurn('opening', dreamPlanet);
  const report = evaluateStExampleTurn(evidence);

  expect(report.score).toBe(1);
  expect(report.passedChecks).toBe(report.totalChecks);
});

test('ST outcome rubric catches tool leakage and missing long-chat lore', () => {
  const cleanTurns = [
    fixtureTurn('promise', dreamPlanet),
    fixtureTurn('core', 'st-lore:The-Planet-s-Core'),
    fixtureTurn('brother', 'st-lore:Isaiah'),
    fixtureTurn('return', dreamPlanet),
  ];
  const passing = evaluateStExampleLongChat(cleanTurns, dreamPlanet);
  expect(passing.score).toBe(1);

  const brokenTurns = cleanTurns.map((turn, index) =>
    index === cleanTurns.length - 1
      ? {
          ...turn,
          responseText: 'assistant: ```json\n{"sceneBrief":"leaked"}\n```',
          relevantLoreRecordIds: [],
        }
      : turn,
  );
  const failing = evaluateStExampleLongChat(brokenTurns, dreamPlanet);
  expect(failing.score).toBeLessThan(1);
  expect(
    failing.checks.find((check) => check.id === 'distant_lore_return')?.passed,
  ).toBe(false);
  expect(
    failing.checks.find((check) => check.id === 'clean_prose_every_turn')
      ?.passed,
  ).toBe(false);
});

function fixtureTurn(
  label: string,
  expectedLoreRecordId: string,
): StExampleTurnEvidence {
  return {
    label,
    responseText: [
      'Xavier held her question between them like a blade laid across both palms. The court could keep its crown and its careful arithmetic; Uluru still waited beyond the starry dark, young and flower-bright, untouched by Wanderers.',
      '“I promised because freedom needed a name,” he said. His glacier gaze did not soften, but Kopis saw the guarded hope beneath it, and that small betrayal of feeling was answer enough.',
    ].join('\n\n'),
    toolNames: ['get_scene_state', 'recall_lore'],
    phases: ['exploring', 'composing', 'idle'],
    relevantLoreRecordIds: [expectedLoreRecordId],
    expectedLoreRecordIds: [expectedLoreRecordId],
    contentAnchorGroups: [
      ['Uluru', 'flower'],
      ['Wanderer', 'freedom'],
    ],
  };
}
