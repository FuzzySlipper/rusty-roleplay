/** Top-level UI mode: in-character roleplay vs out-of-character diagnostics. */
export type RpMode = 'roleplay' | 'mechanic';

export interface MechanicProfileOption {
  readonly id: string;
  readonly name: string;
}

export interface MechanicAutoMonitorConfig {
  readonly enabled: boolean;
  readonly available: boolean;
  readonly status: string;
}

export interface MechanicProfileConfig {
  readonly profileId: string;
  readonly configured: boolean;
  readonly name: string;
  readonly providerAlias?: string;
  readonly autoMonitor: MechanicAutoMonitorConfig;
  readonly localToolProfileId: string;
  readonly toolPolicyIsolated: boolean;
  readonly applies: string;
}

export interface MechanicProfileConfigWrite {
  readonly name: string;
  readonly providerAlias?: string;
  readonly autoMonitor: boolean;
}

export const MECHANIC_PROPOSAL_KINDS = [
  'narrator_config',
  'exemplar',
  'lore_add',
  'lore_edit',
  'lore_tags',
  'layer_retrieval_config',
] as const;

export type MechanicProposalKind = (typeof MECHANIC_PROPOSAL_KINDS)[number];
export type MechanicProposalStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'applied';

export interface MechanicProposalEvent {
  readonly eventId: string;
  readonly kind: string;
  readonly actorId: string;
  readonly note?: string;
  readonly targetRevision?: number;
  readonly details: unknown;
  readonly createdAt: string;
}

export interface MechanicProposal {
  readonly proposalId: string;
  readonly mechanicSessionId: string;
  readonly roleplaySessionId: string;
  readonly profileId: string;
  readonly kind: MechanicProposalKind;
  readonly targetId?: string;
  readonly targetRevision?: number;
  readonly beforeValue: unknown;
  readonly proposedValue: unknown;
  readonly rationale: string;
  readonly diagnosticContext: unknown;
  readonly status: MechanicProposalStatus;
  readonly reviewerId?: string;
  readonly reviewNote?: string;
  readonly reviewedAt?: string;
  readonly appliedAt?: string;
  readonly outcome?: unknown;
  readonly revision: number;
  readonly history: readonly MechanicProposalEvent[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MechanicProposalDecision {
  readonly proposalId: string;
  readonly reviewerId: string;
  readonly expectedRevision: number;
  readonly note?: string;
}

export interface MechanicProposalBatchDecision {
  readonly proposalIds: readonly string[];
  readonly reviewerId: string;
  readonly note?: string;
}

export interface MechanicSessionAssociation {
  readonly mechanicSessionId: string;
  readonly mechanicProfileId: string;
  readonly roleplaySessionId?: string;
  readonly roleplayProfileId?: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MechanicSessionSummary {
  readonly association: MechanicSessionAssociation;
  readonly status: string;
  readonly title?: string;
  readonly archived: boolean;
}

export interface MechanicSessionAttachment {
  readonly mechanicSessionId: string;
  readonly roleplaySessionId?: string;
  readonly expectedRevision: number;
}

export const MECHANIC_DIAGNOSTIC_OUTCOMES = [
  'pending',
  'improved',
  'no_change',
  'worse',
] as const;

export type MechanicDiagnosticOutcome =
  (typeof MECHANIC_DIAGNOSTIC_OUTCOMES)[number];

export interface MechanicDiagnostic {
  readonly diagnosticId: string;
  readonly mechanicSessionId: string;
  readonly mechanicProfileId: string;
  readonly roleplaySessionId: string;
  readonly roleplayProfileId: string;
  readonly symptom: string;
  readonly hypothesis: string;
  readonly proposalIds: readonly string[];
  readonly appliedProposalIds: readonly string[];
  readonly outcome: MechanicDiagnosticOutcome;
  readonly notes?: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MechanicDiagnosticOutcomeWrite {
  readonly diagnosticId: string;
  readonly outcome: MechanicDiagnosticOutcome;
  readonly expectedRevision: number;
  readonly notes?: string;
}
