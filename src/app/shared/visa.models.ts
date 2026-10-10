import { SignatureVisa } from "../types/signature.models";
export type { VisaSignatureMode, SignatureProfile, SignatureVisa } from "../types/signature.models";

export function createEmptyVisa(): SignatureVisa {
  return {
    signed: false,
    signedAt: "",
    signedByName: "",
    signedByUid: "",
  };
}
