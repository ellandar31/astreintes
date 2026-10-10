# Schema relationnel Supabase

## Objectif

Le schema relationnel devient le modele cible de l'application. La table
`app_documents` reste uniquement un pont de migration depuis Firebase et le
stockage document JSONB.

Cette separation permet de deplacer les contraintes metier dans la base :
interventions rattachees a une periode valide, verrouillage apres envoi RH,
visas rattaches a une seule ligne, et requetes RH plus simples a auditer.

Les identifiants primaires `id` sont des cles techniques auto-incrementees par
PostgreSQL. Le seul identifiant externe conserve comme reference metier est
`app_users.auth_user_id`, qui fait le lien avec `auth.users` de Supabase Auth.
Les colonnes temporaires `legacy_document_id` ne doivent pas devenir un contrat
applicatif : elles servent a reconnecter les anciennes relations parent/enfant
pendant la migration, puis le script de reprise les supprime en fin de
traitement.

## Tables principales

### Referentiel

- `app_users` : utilisateur applicatif, role, profil de signature et lien vers
  `auth.users`.
- `teams` : equipe.
- `team_members` : association plusieurs-a-plusieurs entre equipes et
  utilisateurs.
- `schedule_rules` : horaires ouvrables par type de jour.
- `public_holidays` : jours feries par zone.

### Parametrage RH

- `rh_on_call_compensation_rules` : coefficients des astreintes.
- `rh_period_compensation_rules` : coefficients des interventions et travaux.
- `rh_export_settings` : configuration globale de generation documentaire.
- `rh_export_templates` : modeles Word/PDF et modeles de donnees.

### Astreintes regulieres

- `regular_on_call_periods` : periode d'astreinte d'un utilisateur dans une
  equipe.
- `regular_interventions` : intervention rattachee a une astreinte reguliere.

La base controle qu'une intervention reguliere reste dans la periode de son
astreinte parente et pour le meme utilisateur.

### Operations exceptionnelles

- `exceptional_operations` : operation exceptionnelle ou travaux
  supplementaires.
- `exceptional_operation_participants` : periodes previsionnelles ou reelles par
  utilisateur.
- `exceptional_interventions` : interventions realisees pendant une operation.

La base controle qu'une intervention exceptionnelle reste dans une periode
reelle du meme utilisateur.

### Visas

- `visas` : signature rattachee a une seule cible metier.

Le champ `scope` distingue les visas agent, initiateur et directeur. Les index
uniques garantissent une seule signature par scope et par ligne.

## Strategie de migration

1. Appliquer la migration relationnelle sans supprimer `app_documents`.
2. Ajouter des repositories relationnels dans le store central.
3. Migrer les donnees existantes depuis `app_documents` vers les nouvelles
   tables avec `supabase/migrations/20260912173000_migrate_app_documents_to_relational.sql`.
4. Basculer les effects NgRx feature par feature.
5. Supprimer `app_documents` seulement quand les ecrans, exports et tests ne
   l'utilisent plus.

Cette approche evite une bascule brutale : l'application peut continuer a
fonctionner pendant que les modules sont branches progressivement sur le modele
relationnel.
