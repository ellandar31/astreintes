# Opérations exceptionnelles (EXC)

> Cas de test manuels — exécution sur environnement de recette exclusivement.

## EXC-001 — Création multi-participants

**Priorité :** Haute  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 créées; connexion avec init.bob@example.test.  
**Jeu de données :** `EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 » dans un état initial connu.
3. Exécuter l’action : Créer une astreinte exceptionnelle avec plusieurs agents.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Participants et périodes conservés; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXC-002 — Visibilité participant

**Priorité :** Critique  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 » dans un état initial connu.
3. Exécuter l’action : Consulter une opération participée puis étrangère.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Participée visible, étrangère non visible dans la liste; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXC-003 — Modification opération propre

**Priorité :** Haute  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 créées; connexion avec init.bob@example.test.  
**Jeu de données :** `EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 » dans un état initial connu.
3. Exécuter l’action : Modifier une opération initiée.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Modification acceptée; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXC-004 — Modification opération étrangère

**Priorité :** Critique  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 créées; connexion avec init.bob@example.test.  
**Jeu de données :** `EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 » dans un état initial connu.
3. Exécuter l’action : Tenter modification opération seulement participée.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Modification du planning refusée; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXC-005 — Intervention hors période réelle

**Priorité :** Critique  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 » dans un état initial connu.
3. Exécuter l’action : Saisir intervention hors période réelle du même agent.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Enregistrement refusé; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXC-006 — Intervention autre agent

**Priorité :** Critique  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 » dans un état initial connu.
3. Exécuter l’action : Tenter modification intervention d’un autre agent.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Modification refusée; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXC-007 — Périodes multiples

**Priorité :** Haute  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 créées; connexion avec init.bob@example.test.  
**Jeu de données :** `EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 » dans un état initial connu.
3. Exécuter l’action : Ajouter deux périodes distinctes au même participant.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Périodes enregistrées sans fusion incorrecte; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXC-008 — Suppression opération

**Priorité :** Haute  
**Profil :** Directeur (direction.diane@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 créées; connexion avec direction.diane@example.test.  
**Jeu de données :** `EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Directeur » (direction.diane@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / Alice + Bruno / 10 novembre 18:00–23:00 » dans un état initial connu.
3. Exécuter l’action : Supprimer opération non envoyée RH.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Suppression autorisée et cohérente; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

