# Authentification et contrôle de session (AUTH)

> Cas de test manuels — exécution sur environnement de recette exclusivement.

## AUTH-001 — Connexion valide

**Priorité :** Critique  
**Profil :** Tous (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données COMPTE-ACTIF / COMPTE-INVALIDE créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `COMPTE-ACTIF / COMPTE-INVALIDE`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Tous » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « COMPTE-ACTIF / COMPTE-INVALIDE » dans un état initial connu.
3. Exécuter l’action : Se connecter avec un compte actif.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Accueil accessible; profil correct; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## AUTH-002 — Mot de passe invalide

**Priorité :** Critique  
**Profil :** Tous (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données COMPTE-ACTIF / COMPTE-INVALIDE créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `COMPTE-ACTIF / COMPTE-INVALIDE`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Tous » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « COMPTE-ACTIF / COMPTE-INVALIDE » dans un état initial connu.
3. Exécuter l’action : Saisir un mot de passe erroné.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Accès refusé sans divulgation; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## AUTH-003 — Déconnexion

**Priorité :** Critique  
**Profil :** Tous (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données COMPTE-ACTIF / COMPTE-INVALIDE créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `COMPTE-ACTIF / COMPTE-INVALIDE`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Tous » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « COMPTE-ACTIF / COMPTE-INVALIDE » dans un état initial connu.
3. Exécuter l’action : Se déconnecter puis revenir en arrière.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Données privées inaccessibles; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## AUTH-004 — Rafraîchissement session

**Priorité :** Haute  
**Profil :** Tous (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données COMPTE-ACTIF / COMPTE-INVALIDE créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `COMPTE-ACTIF / COMPTE-INVALIDE`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Tous » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « COMPTE-ACTIF / COMPTE-INVALIDE » dans un état initial connu.
3. Exécuter l’action : Recharger la page après connexion.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Session cohérente, sans privilège supplémentaire; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## AUTH-005 — Accès anonyme

**Priorité :** Critique  
**Profil :** Anonyme (aucun compte)  
**Préconditions :** Session anonyme; URL de l’application accessible.  
**Jeu de données :** `COMPTE-ACTIF / COMPTE-INVALIDE`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Anonyme » (aucun compte), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « COMPTE-ACTIF / COMPTE-INVALIDE » dans un état initial connu.
3. Exécuter l’action : Ouvrir directement une URL interne.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Aucune donnée métier accessible; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

