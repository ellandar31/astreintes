# Accès aux exports RH

Les rubriques d'export par opération et par période sont accessibles uniquement
aux profils administrateur (0) et directeur (3). Le sélecteur NgRx
selectCanExportRh repose sur le profil SQL associé à la session ; un profil
absent, utilisateur ou initiateur ne donne aucun droit d'export.

La page masque ces deux rubriques et refuse leur ouverture directe. Le composant
d'export vérifie aussi les droits sur chaque format (Word, PDF, Excel, JSON),
l'export Excel par période et le marquage d'envoi RH. Après révocation, la rubrique
ouverte est fermée et une génération asynchrone ne peut plus télécharger de fichier.
La rubrique Contrôles conserve son accès existant.

Ces contrôles concernent l'application Angular. Ils ne modifient pas les règles
SQL de lecture ni l'autorisation du service externe de génération documentaire.

Tests : matrice des quatre profils, profil absent, contenu masqué et appels
directs sans téléchargement ni modification après révocation des droits.
