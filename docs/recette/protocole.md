# Protocole de campagne

## Entrée
- Version/commit et URL de recette identifiés.
- Base de recette et comptes de test disponibles.
- Jeux de données chargés et barème RH approuvé.
- Périmètre, responsables et critères de décision validés.

## Exécution
1. Créer une campagne dans l'onglet `Campagnes` du classeur.
2. Pour chaque scénario, relever l'ID, la campagne, le résultat, le testeur, la date, la preuve et l'anomalie éventuelle dans `Exécutions`.
3. Pour tout KO, ouvrir une issue GitHub avec version, rôle, objet, étapes de reproduction, attendu, observé et capture expurgée.
4. Après correction, rejouer le test et les régressions connexes dans une nouvelle exécution.

## Statuts
`Non testé`, `OK`, `KO`, `Bloqué`, `Non applicable`.

## Sortie indicative
- 100 % des cas critiques exécutés ou explicitement justifiés.
- Aucun KO critique non accepté.
- Anomalies restantes documentées, arbitrées et affectées.
- Décision de mise en production consignée par le responsable de recette.

## Limites
Les tests manuels UI ne démontrent pas à eux seuls l'étanchéité RLS, les droits des API ou l'absence de vulnérabilités. Prévoir une campagne technique dédiée.
