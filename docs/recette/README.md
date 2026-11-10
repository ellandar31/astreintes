# Référentiel de recette — Astreintes et travaux supplémentaires

## Objet
Recette fonctionnelle manuelle, reproductible, pour l’application Astreintes. Les scénarios ont des identifiants stables et sont suivis par campagne dans le classeur Excel fourni séparément.

## Références
- `README.md` du projet
- `docs/access-rules.md` : droits par rôle, visas et envoi RH
- `docs/type-catalog.md` : modèle métier

## Organisation
- `docs/recette/jeux-de-donnees.md` : utilisateurs, opérations, dates et paramètres de test
- `docs/recette/cas/` : cas de test par domaine
- `docs/recette/protocole.md` : exécution, critères d'entrée/sortie, preuves et anomalies
- `docs/recette/matrice.md` : inventaire des scénarios

## Précautions
Utiliser une base de recette et des identités fictives. Ne pas transmettre de données RH réelles. Les scénarios de refus dans l'IHM ne remplacent pas des vérifications API, RLS PostgreSQL ou tests d'intrusion. Les règles de calcul et coefficients doivent être validés sur le barème de recette avant décision de conformité.
