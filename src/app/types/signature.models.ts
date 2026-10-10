export type VisaSignatureMode = "name" | "image" | "draw";

/** Relational signature targets are explicit so a visa cannot attach to an arbitrary column. */
export type VisaTargetColumn = "regular_period_id" | "regular_intervention_id" | "exceptional_operation_id" | "exceptional_participant_id" | "exceptional_intervention_id";
export type VisaScope =
  | "regular_period_agent" | "regular_period_director" | "regular_intervention_agent"
  | "exceptional_participant_agent" | "exceptional_intervention_agent"
  | "exceptional_operation_initiator" | "exceptional_operation_director"
  | "exceptional_planned_initiator" | "exceptional_planned_director"
  | "exceptional_actual_initiator" | "exceptional_actual_director";

export interface SignatureProfile {
  displayName?: string;
  signatureMode?: VisaSignatureMode;
  signatureName?: string;
  signatureImage?: string;
  signatureDrawing?: string;
}

export interface SignatureVisa {
  signed: boolean;
  signedAt: string;
  signedByName: string;
  signedByUid: string;
  signatureMode?: VisaSignatureMode;
  signatureValue?: string;
}

