# Profil et signatures (PRO)

> Cas de test manuels — exécution sur environnement de recette exclusivement.

## PRO-001 — Modification nom

**Priorité :** Haute  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données Compte Alice / signature TEST-ALICE créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `Compte Alice / signature TEST-ALICE`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Compte Alice / signature TEST-ALICE » dans un état initial connu.
3. Exécuter l’action : Modifier nom du profil.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Nom enregistré sans changement de rôle; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## PRO-002 — Signature dessinée

**Priorité :** Haute  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données Compte Alice / signature TEST-ALICE créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `Compte Alice / signature TEST-ALICE`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Compte Alice / signature TEST-ALICE » dans un état initial connu.
3. Exécuter l’action : Dessiner et sauvegarder signature.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Signature réutilisable; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## PRO-003 — Signature importée

**Priorité :** Moyenne  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données Compte Alice / signature TEST-ALICE créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `Compte Alice / signature TEST-ALICE`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Compte Alice / signature TEST-ALICE » dans un état initial connu.
3. Exécuter l’action : Importer image de signature.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Signature affichée correctement; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## PRO-004 — Modification autre profil

**Priorité :** Critique  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données Compte Alice / signature TEST-ALICE créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `Compte Alice / signature TEST-ALICE`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Compte Alice / signature TEST-ALICE » dans un état initial connu.
3. Exécuter l’action : Tenter modifier profil autre agent.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Refus; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

