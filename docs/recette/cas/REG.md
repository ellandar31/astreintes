# Astreintes régulières et calendrier (REG)

> Cas de test manuels — exécution sur environnement de recette exclusivement.

## REG-001 — Création période

**Priorité :** Haute  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre créées; connexion avec init.bob@example.test.  
**Jeu de données :** `REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre » dans un état initial connu.
3. Exécuter l’action : Créer une période avec agent et dates valides.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Période enregistrée et visible au calendrier; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## REG-002 — Consultation calendrier

**Priorité :** Haute  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre » dans un état initial connu.
3. Exécuter l’action : Naviguer entre mois et équipes.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Périodes correctes et lisibles; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## REG-003 — Intervention personnelle

**Priorité :** Haute  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre » dans un état initial connu.
3. Exécuter l’action : Ajouter une intervention sur une période existante.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Intervention persistée et visible; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## REG-004 — Modification planning interdite

**Priorité :** Critique  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre » dans un état initial connu.
3. Exécuter l’action : Tenter de modifier une affectation.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Modification refusée; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## REG-005 — Période invalide

**Priorité :** Haute  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre créées; connexion avec init.bob@example.test.  
**Jeu de données :** `REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre » dans un état initial connu.
3. Exécuter l’action : Saisir fin antérieure au début.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Enregistrement refusé; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## REG-006 — Chevauchement périodes

**Priorité :** Haute  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre créées; connexion avec init.bob@example.test.  
**Jeu de données :** `REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre » dans un état initial connu.
3. Exécuter l’action : Créer deux périodes recouvrantes pour le même agent.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Chevauchement refusé; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## REG-007 — Modification et suppression

**Priorité :** Haute  
**Profil :** Administrateur (admin.recette@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre créées; connexion avec admin.recette@example.test.  
**Jeu de données :** `REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Administrateur » (admin.recette@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / Alice / équipe Alpha / 02-08 novembre » dans un état initial connu.
3. Exécuter l’action : Modifier puis supprimer une période de test.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Données mises à jour puis retirées; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

