export interface StExampleTurnEvidence {
  readonly label: string;
  readonly responseText: string;
  readonly toolNames: readonly string[];
  readonly phases: readonly string[];
  readonly relevantLoreRecordIds: readonly string[];
  readonly expectedLoreRecordIds: readonly string[];
  readonly contentAnchorGroups: readonly (readonly string[])[];
}

export interface StExampleCheck {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface StExampleTurnReport {
  readonly label: string;
  readonly score: number;
  readonly passedChecks: number;
  readonly totalChecks: number;
  readonly contentAnchorHits: number;
  readonly checks: readonly StExampleCheck[];
}

export interface StExampleLongChatReport {
  readonly score: number;
  readonly passedChecks: number;
  readonly totalChecks: number;
  readonly turnReports: readonly StExampleTurnReport[];
  readonly checks: readonly StExampleCheck[];
}

const TECHNICAL_ARTIFACT =
  /(?:sceneBrief|relevantLore|recall_lore|tool_call|```json|\[TOOL|assistant:)/i;

export function evaluateStExampleTurn(
  evidence: StExampleTurnEvidence,
): StExampleTurnReport {
  const normalizedText = evidence.responseText.toLowerCase();
  const contentAnchorHits = evidence.contentAnchorGroups.filter((group) =>
    group.some((anchor) => normalizedText.includes(anchor.toLowerCase())),
  ).length;
  const expectedLore = new Set(evidence.expectedLoreRecordIds);
  const retrievedLore = new Set(evidence.relevantLoreRecordIds);
  const paragraphs = evidence.responseText
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim().length > 0);
  const checks: StExampleCheck[] = [
    {
      id: 'substantial_roleplay_prose',
      passed:
        evidence.responseText.trim().length >= 240 && paragraphs.length >= 2,
      detail: `${evidence.responseText.trim().length} characters across ${paragraphs.length} paragraphs`,
    },
    {
      id: 'clean_narrative_output',
      passed: !TECHNICAL_ARTIFACT.test(evidence.responseText),
      detail:
        'assistant prose must not expose prompt, tool, or diagnostic syntax',
    },
    {
      id: 'narrator_lifecycle',
      passed:
        evidence.phases.includes('exploring') &&
        evidence.phases.includes('composing') &&
        evidence.phases.at(-1) === 'idle',
      detail: evidence.phases.join(' -> '),
    },
    {
      id: 'lore_recall_tool',
      passed: evidence.toolNames.includes('recall_lore'),
      detail: evidence.toolNames.join(', '),
    },
    {
      id: 'expected_lore_retrieved',
      passed: [...expectedLore].every((recordId) =>
        retrievedLore.has(recordId),
      ),
      detail: `expected ${[...expectedLore].join(', ')}; retrieved ${[
        ...retrievedLore,
      ].join(', ')}`,
    },
    {
      id: 'lore_visible_in_story',
      passed:
        evidence.contentAnchorGroups.length === 0 || contentAnchorHits > 0,
      detail: `${contentAnchorHits}/${evidence.contentAnchorGroups.length} content anchor groups represented`,
    },
  ];
  const passedChecks = checks.filter((check) => check.passed).length;
  return {
    label: evidence.label,
    score: passedChecks / checks.length,
    passedChecks,
    totalChecks: checks.length,
    contentAnchorHits,
    checks,
  };
}

export function evaluateStExampleLongChat(
  evidence: readonly StExampleTurnEvidence[],
  recurringLoreRecordId: string,
): StExampleLongChatReport {
  const turnReports = evidence.map(evaluateStExampleTurn);
  const first = evidence.at(0);
  const last = evidence.at(-1);
  const checks: StExampleCheck[] = [
    {
      id: 'multi_turn_endurance',
      passed: evidence.length >= 4,
      detail: `${evidence.length} live turns evaluated`,
    },
    {
      id: 'recall_every_turn',
      passed: evidence.every((turn) => turn.toolNames.includes('recall_lore')),
      detail: `${evidence.filter((turn) => turn.toolNames.includes('recall_lore')).length}/${evidence.length} turns called recall_lore`,
    },
    {
      id: 'expected_lore_every_turn',
      passed: turnReports.every(
        (report) =>
          report.checks.find((check) => check.id === 'expected_lore_retrieved')
            ?.passed === true,
      ),
      detail: `${turnReports.filter((report) => report.checks.find((check) => check.id === 'expected_lore_retrieved')?.passed).length}/${turnReports.length} turns retrieved their expected records`,
    },
    {
      id: 'clean_prose_every_turn',
      passed: turnReports.every(
        (report) =>
          report.checks.find((check) => check.id === 'clean_narrative_output')
            ?.passed === true,
      ),
      detail: 'no roleplay response exposed tool or reasoning syntax',
    },
    {
      id: 'distant_lore_return',
      passed:
        first?.relevantLoreRecordIds.includes(recurringLoreRecordId) === true &&
        last?.relevantLoreRecordIds.includes(recurringLoreRecordId) === true,
      detail: `${recurringLoreRecordId} must be recalled before and after intervening lore topics`,
    },
    {
      id: 'story_content_alignment',
      passed: turnReports.every((report) => report.contentAnchorHits > 0),
      detail: `${turnReports.filter((report) => report.contentAnchorHits > 0).length}/${turnReports.length} turns surfaced a target lore concept in prose`,
    },
  ];
  const passedChecks = checks.filter((check) => check.passed).length;
  return {
    score: passedChecks / checks.length,
    passedChecks,
    totalChecks: checks.length,
    turnReports,
    checks,
  };
}
