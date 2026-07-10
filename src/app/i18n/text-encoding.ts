const MOJIBAKE_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["\u00c3\u20ac", "À"],
  ["\u00c3\u201a", "\u00c2"],
  ["\u00c3\u2021", "Ç"],
  ["\u00c3\u2030", "É"],
  ["\u00c3\u02c6", "È"],
  ["\u00c3\u0160", "Ê"],
  ["\u00c3\u2039", "Ë"],
  ["\u00c3\u201d", "Ô"],
  ["\u00c3\u2122", "Ù"],
  ["\u00c3\u203a", "Û"],
  ["\u00c3\u0153", "Ü"],
  ["\u00c3\u00a0", "à"],
  ["\u00c3\u00a2", "â"],
  ["\u00c3\u00a7", "ç"],
  ["\u00c3\u00a9", "é"],
  ["\u00c3\u00a8", "è"],
  ["\u00c3\u00aa", "ê"],
  ["\u00c3\u00ab", "ë"],
  ["\u00c3\u00ae", "î"],
  ["\u00c3\u00af", "ï"],
  ["\u00c3\u00b4", "ô"],
  ["\u00c3\u00b9", "ù"],
  ["\u00c3\u00bb", "û"],
  ["\u00c3\u00bc", "ü"],
  ["\u00c2\u00b7", "·"],
  ["\u00c2\u00b0", "°"],
  ["\u00c2\u00a0", " "],
  ["\u00e2\u20ac\u2122", "’"],
  ["\u00e2\u20ac\u0153", "“"],
  ["\u00e2\u20ac\u009d", "”"],
  ["\u00e2\u20ac\u201c", "–"],
  ["\u00e2\u20ac\u201d", "—"],
  ["\u00e2\u20ac\u00a6", "…"],
  ["\u00e2\u20ac\u00b9", "‹"],
  ["\u00e2\u20ac\u00ba", "›"],
];

export function normalizeTextEncoding(value: string): string {
  let normalized = value;

  MOJIBAKE_REPLACEMENTS.forEach(([source, replacement]) => {
    normalized = normalized.replaceAll(source, replacement);
  });

  return normalized.normalize("NFC");
}

export function normalizeObjectTextEncoding<T>(value: T): T {
  if (typeof value === "string") {
    return normalizeTextEncoding(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeObjectTextEncoding(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeObjectTextEncoding(item)]),
    ) as T;
  }

  return value;
}
