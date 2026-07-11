import { SignatureProfile, SignatureVisa } from "../../shared/visa.models";
import { ExceptionalOperation } from "../exceptionnel/exceptional.models";
import { RegularIntervention, RegularOnCallPeriod } from "../regular/regular.models";

export type ValidationItemKind =
  | "regular-period-agent"
  | "regular-period-director"
  | "regular-intervention-agent"
  | "exceptional-operation-agent"
  | "exceptional-participant-planned"
  | "exceptional-participant-actual"
  | "exceptional-intervention-agent"
  | "exceptional-operation-initiator"
  | "exceptional-operation-director";

export interface AppUser extends SignatureProfile {
  id: string;
  uid?: string;
  displayName: string;
  email: string;
  role?: number;
}

export interface ValidationItem {
  id: string;
  kind: ValidationItemKind;
  category: string;
  title: string;
  userLabel: string;
  startDate: string;
  endDate: string;
  visa: SignatureVisa;
  payload: RegularOnCallPeriod | RegularIntervention | ExceptionalOperation;
  index?: number;
  isGlobalAction?: boolean;
  userEmail?: string;
  userId?: string;
}

export interface VisaProgressItem {
  id: string;
  role: string;
  userLabel: string;
  startDate: string;
  endDate: string;
  visa: SignatureVisa;
  actionItem?: ValidationItem;
}

export type ValidationSectionId = "stakeholder" | "initiator" | "director";

export interface ValidationSection {
  id: ValidationSectionId;
  title: string;
  emptyText: string;
  items: ValidationItem[];
}
