# Ergonomie, validation et robustesse (IHM)

> Cas de test manuels — exécution sur environnement de recette exclusivement.

## IHM-001 — Navigation

**Priorité :** Moyenne  
**Profil :** Tous (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données Compte Alice et Initiateur / navigateurs desktop et mobile créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `Compte Alice et Initiateur / navigateurs desktop et mobile`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Tous » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Compte Alice et Initiateur / navigateurs desktop et mobile » dans un état initial connu.
3. Exécuter l’action : Parcourir tous menus autorisés.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Navigation sans erreur; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## IHM-002 — Affichage mobile

**Priorité :** Moyenne  
**Profil :** Tous (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données Compte Alice et Initiateur / navigateurs desktop et mobile créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `Compte Alice et Initiateur / navigateurs desktop et mobile`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Tous » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Compte Alice et Initiateur / navigateurs desktop et mobile » dans un état initial connu.
3. Exécuter l’action : Ouvrir en écran étroit.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Contenu exploitable; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## IHM-003 — Erreurs saisie

**Priorité :** Haute  
**Profil :** Tous (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données Compte Alice et Initiateur / navigateurs desktop et mobile créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `Compte Alice et Initiateur / navigateurs desktop et mobile`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Tous » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Compte Alice et Initiateur / navigateurs desktop et mobile » dans un état initial connu.
3. Exécuter l’action : Laisser champs obligatoires vides.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Messages explicites; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## IHM-004 — Perte réseau

**Priorité :** Haute  
**Profil :** Tous (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données Compte Alice et Initiateur / navigateurs desktop et mobile créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `Compte Alice et Initiateur / navigateurs desktop et mobile`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Tous » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Compte Alice et Initiateur / navigateurs desktop et mobile » dans un état initial connu.
3. Exécuter l’action : Couper réseau pendant sauvegarde.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Erreur affichée sans faux succès; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

