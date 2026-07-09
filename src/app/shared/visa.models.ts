export type VisaSignatureMode = "name" | "image" | "draw";

export interface SignatureProfile {
  isDirector?: boolean;
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

export function createEmptyVisa(): SignatureVisa {
  return {
    signed: false,
    signedAt: "",
    signedByName: "",
    signedByUid: "",
  };
}
