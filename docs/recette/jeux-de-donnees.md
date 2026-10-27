# Jeux de données de recette

## Comptes fictifs

| Profil | Identifiant fictif | Utilisation |
|---|---|---|
| Administrateur | admin.recette@example.test | Configuration et rôles |
| Utilisateur Alice | agent.alice@example.test | Agent participant |
| Utilisateur Chloé | agent.chloe@example.test | Agent non participant / contrôles négatifs |
| Initiateur Bob | init.bob@example.test | Création d’opérations |
| Directeur Diane | direction.diane@example.test | Approbation |
| RH Emma | rh.emma@example.test | Envoi et export |

Créer également Bruno comme second agent et un autre initiateur pour les scénarios d’opérations étrangères. Attribuer les rôles applicatifs réels, et non simplement les noms d’affichage.

## Opérations

| Référence | Type | Dates / agents | État initial |
|---|---|---|---|
| REG-2026-11-02 | Astreinte régulière | Alice, équipe REC-ALPHA, 02 au 08/11/2026 | Non envoyée RH |
| EXC-2026-11-10 | Astreinte exceptionnelle | Alice + Bruno, 10/11/2026 de 18 h à 23 h | Non validée |
| TRV-2026-11-12 | Travaux supplémentaires | Alice + Bruno, 12/11/2026 de 18 h à 21 h | Non validés |
| EXC-ETRANGERE | Astreinte exceptionnelle | Chloé; initiateur différent de Bob | Non envoyée RH |

## Variantes obligatoires

- Intervention d’Alice de 20 h 30 à 22 h 30 pour traverser une plage horaire; intervention de 23 h 30 à 01 h 00 le lendemain pour franchir minuit.
- Saisie d’une date de fin antérieure au début, chevauchement, agent non affecté et champ obligatoire vide.
- Copie des opérations avec visas partiels, visas complets, approbation Directeur, puis envoi RH.
- Une opération envoyée RH et une non envoyée dans la même période d’export.
- Jour férié de référence du 11/11/2026, à confirmer dans la configuration des jours fériés.

## Barème

Créer `BAREME-REC-01` : copie **documentée et approuvée** du barème configuré sur l’environnement de recette (coefficients, tranches horaires, arrondis, unités et règles de repos). Ne pas inventer de valeurs de rémunération. Consigner les résultats manuels attendus avant les tests RH.

## Réinitialisation

Repartir des objets de référence ou les recréer sous de nouveaux identifiants à chaque campagne. Annuler les visas/envois RH et restaurer les coefficients modifiés lors des tests de paramétrage. Ne jamais effectuer ces essais en production.
