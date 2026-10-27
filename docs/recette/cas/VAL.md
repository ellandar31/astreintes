# Circuit des visas et approbations (VAL)

> Cas de test manuels — exécution sur environnement de recette exclusivement.

## VAL-001 — Visa agent

**Priorité :** Critique  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH » dans un état initial connu.
3. Exécuter l’action : Signer sa ligne avec une signature.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Visa et identité signataire conservés; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## VAL-002 — Visa autre agent

**Priorité :** Critique  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH » dans un état initial connu.
3. Exécuter l’action : Tenter signer une ligne étrangère.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Refus; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## VAL-003 — Visa initiateur sur propre opération

**Priorité :** Critique  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH créées; connexion avec init.bob@example.test.  
**Jeu de données :** `EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH » dans un état initial connu.
3. Exécuter l’action : Signer ligne participante opération initiée.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Signature propre à initiateur enregistrée; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## VAL-004 — Visa initiateur opération étrangère

**Priorité :** Critique  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH créées; connexion avec init.bob@example.test.  
**Jeu de données :** `EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH » dans un état initial connu.
3. Exécuter l’action : Tenter signer ligne participante d’une opération étrangère.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Refus; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## VAL-005 — Approbation prématurée

**Priorité :** Critique  
**Profil :** Directeur (direction.diane@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH créées; connexion avec direction.diane@example.test.  
**Jeu de données :** `EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Directeur » (direction.diane@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH » dans un état initial connu.
3. Exécuter l’action : Approuver avant tous les visas préalables.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Approbation refusée; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## VAL-006 — Approbation complète

**Priorité :** Critique  
**Profil :** Directeur (direction.diane@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH créées; connexion avec direction.diane@example.test.  
**Jeu de données :** `EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Directeur » (direction.diane@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH » dans un état initial connu.
3. Exécuter l’action : Compléter visas puis approuver.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Approbation acceptée; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## VAL-007 — Retrait visa préalable

**Priorité :** Critique  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH » dans un état initial connu.
3. Exécuter l’action : Retirer un visa personnel préalable à approbation.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Approbation dépendante révoquée; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## VAL-008 — Retrait visa autre signataire

**Priorité :** Critique  
**Profil :** Directeur (direction.diane@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH créées; connexion avec direction.diane@example.test.  
**Jeu de données :** `EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Directeur » (direction.diane@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH » dans un état initial connu.
3. Exécuter l’action : Tenter retirer visa signé par autrui.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Refus sauf administrateur; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## VAL-009 — Visa global agent

**Priorité :** Haute  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH » dans un état initial connu.
3. Exécuter l’action : Signer globalement une opération avec interventions.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Interventions associées également visées; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## VAL-010 — Parité RH directeur

**Priorité :** Critique  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 / visas Alice, Bruno, Initiateur, Direction, RH » dans un état initial connu.
3. Exécuter l’action : Réaliser une approbation directeur.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Droit identique au Directeur; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

