const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/** Rebuild the inventory from declarations, so renames cannot leave a hand-maintained type list stale. */
function inventory(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return inventory(file);
    if (!file.endsWith(".ts") || /\.(?:jest-spec|spec)\.ts$/.test(file)) return [];
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const names = source.statements.filter(node => ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)).map(node => node.name.text);
    return names.length ? [{ file: file.replaceAll(path.sep, "/"), names }] : [];
  });
}

const rows = inventory("src/app").sort((first, second) => first.file.localeCompare(second.file));
const content = [
  "# Catalogue des types",
  "",
  "Point d'import partagé : `src/app/types/index.ts`. Les modèles sont définis une seule fois,",
  "dans des fichiers regroupés par domaine. Les anciens fichiers `pages/*/*.models.ts`",
  "réexportent ces définitions pour préserver les imports existants.",
  "",
  "Les types locaux des composants, des calculs et des états NgRx restent chez leur propriétaire :",
  "ils sont inventoriés ci-dessous, mais ne doivent pas devenir des contrats partagés par défaut.",
  "",
  "## Règles de maintenance",
  "",
  "- Ajouter un modèle partagé dans `src/app/types/`, puis le réexporter depuis `index.ts`.",
  "- Utiliser des projections (`Pick`, `Omit`) pour réutiliser les mêmes champs plutôt que les dupliquer.",
  "- Réserver `JsonRecord` aux valeurs non typées à la frontière Supabase/JSONB.",
  "- Les repositories renvoient directement les objets métier ; aucun type Document n'est nécessaire.",
  "- Les identifiants applicatifs sont des chaînes côté Angular, numériques côté PostgreSQL ; `uid` porte l'UUID Auth.",
  "- Les champs de période utilisent une date/heure locale ; les horodatages de signature/envoi RH conservent leur fuseau.",
  "- Pour les mises à jour RH, omission = conserver la date ; `null` = annuler l'envoi.",
  "- Régénérer ce fichier avec `npm run docs:types` après un changement de déclaration.",
  "",
  "## Définitions partagées",
  "",
  "| Fichier | Types |", "| --- | --- |",
  ...rows.filter(row => row.file.startsWith("src/app/types/")).map(row => `| [${path.basename(row.file)}](../${row.file}) | ${row.names.map(name => '`' + name + '`').join(', ')} |`),
  "",
  "## Définitions locales et projections de fonctionnalités",
  "",
  "| Fichier propriétaire | Types |", "| --- | --- |",
  ...rows.filter(row => !row.file.startsWith("src/app/types/")).map(row => `| [${row.file}](../${row.file}) | ${row.names.map(name => '`' + name + '`').join(', ')} |`),
  "",
].join("\n");
fs.writeFileSync("docs/type-catalog.md", content);
