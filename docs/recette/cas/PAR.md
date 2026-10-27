# Administration et paramétrage (PAR)

> Cas de test manuels — exécution sur environnement de recette exclusivement.

## PAR-001 — Création utilisateur

**Priorité :** Critique  
**Profil :** Administrateur (admin.recette@example.test)  
**Préconditions :** Environnement de recette isolé; données Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 créées; connexion avec admin.recette@example.test.  
**Jeu de données :** `Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Administrateur » (admin.recette@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Créer/activer profil applicatif.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.
6. Restaurer les paramètres et comptes de référence après exécution.

**Résultat attendu :** Rôle utilisateur par défaut; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## PAR-002 — Changement rôle

**Priorité :** Critique  
**Profil :** Administrateur (admin.recette@example.test)  
**Préconditions :** Environnement de recette isolé; données Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 créées; connexion avec admin.recette@example.test.  
**Jeu de données :** `Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Administrateur » (admin.recette@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Changer rôle utilisateur.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.
6. Restaurer les paramètres et comptes de référence après exécution.

**Résultat attendu :** Rôle persisté et appliqué; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## PAR-003 — Changement rôle interdit

**Priorité :** Critique  
**Profil :** Directeur (direction.diane@example.test)  
**Préconditions :** Environnement de recette isolé; données Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 créées; connexion avec direction.diane@example.test.  
**Jeu de données :** `Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Directeur » (direction.diane@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Tenter attribuer rôle.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.
6. Restaurer les paramètres et comptes de référence après exécution.

**Résultat attendu :** Refus; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## PAR-004 — Gestion équipes

**Priorité :** Haute  
**Profil :** Administrateur (admin.recette@example.test)  
**Préconditions :** Environnement de recette isolé; données Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 créées; connexion avec admin.recette@example.test.  
**Jeu de données :** `Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Administrateur » (admin.recette@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Créer, modifier équipe de test.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.
6. Restaurer les paramètres et comptes de référence après exécution.

**Résultat attendu :** Persistance correcte; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## PAR-005 — Jours fériés

**Priorité :** Haute  
**Profil :** Administrateur (admin.recette@example.test)  
**Préconditions :** Environnement de recette isolé; données Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 créées; connexion avec admin.recette@example.test.  
**Jeu de données :** `Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Administrateur » (admin.recette@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Ajouter jour férié.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.
6. Restaurer les paramètres et comptes de référence après exécution.

**Résultat attendu :** Calcul RH le prend en compte; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## PAR-006 — Coefficients

**Priorité :** Critique  
**Profil :** Administrateur (admin.recette@example.test)  
**Préconditions :** Environnement de recette isolé; données Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 créées; connexion avec admin.recette@example.test.  
**Jeu de données :** `Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Administrateur » (admin.recette@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Modifier coefficient de test.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.
6. Restaurer les paramètres et comptes de référence après exécution.

**Résultat attendu :** Nouveaux calculs conformes; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## PAR-007 — Coefficients non admin

**Priorité :** Critique  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Equipe REC-ALPHA / jour férié fictif 2026-11-11 / BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Tenter modification coefficient.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.
6. Restaurer les paramètres et comptes de référence après exécution.

**Résultat attendu :** Refus; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

