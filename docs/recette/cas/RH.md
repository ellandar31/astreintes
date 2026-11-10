# Calculs, contrôle et transmission RH (RH)

> Cas de test manuels — exécution sur environnement de recette exclusivement.

## RH-001 — Calcul semaine

**Priorité :** Critique  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Créer astreinte semaine puis vérifier calcul.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Comparer chaque durée, plage horaire et coefficient au barème BAREME-REC-01 approuvé par RH; calculer manuellement le montant de référence.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Montant conforme au barème paramétré; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## RH-002 — Calcul samedi

**Priorité :** Critique  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Créer période samedi.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Comparer chaque durée, plage horaire et coefficient au barème BAREME-REC-01 approuvé par RH; calculer manuellement le montant de référence.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Coefficient samedi correct; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## RH-003 — Calcul dimanche et férié

**Priorité :** Critique  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Créer période dimanche et jour férié.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Comparer chaque durée, plage horaire et coefficient au barème BAREME-REC-01 approuvé par RH; calculer manuellement le montant de référence.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Coefficients et découpage corrects; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## RH-004 — Découpage horaires nuit

**Priorité :** Critique  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Intervention franchissant 21h puis 07h.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Comparer chaque durée, plage horaire et coefficient au barème BAREME-REC-01 approuvé par RH; calculer manuellement le montant de référence.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Ventilation conforme aux plages; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## RH-005 — Passage minuit

**Priorité :** Critique  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Intervention sur deux jours.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Comparer chaque durée, plage horaire et coefficient au barème BAREME-REC-01 approuvé par RH; calculer manuellement le montant de référence.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Durée et ventilation exactes; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## RH-006 — Repos compensateur

**Priorité :** Haute  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Choisir compensation en repos.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Comparer chaque durée, plage horaire et coefficient au barème BAREME-REC-01 approuvé par RH; calculer manuellement le montant de référence.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Calcul cohérent avec règles; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## RH-007 — Contrôles mensuels

**Priorité :** Critique  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Choisir agent et mois d’envoi RH.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Comparer chaque durée, plage horaire et coefficient au barème BAREME-REC-01 approuvé par RH; calculer manuellement le montant de référence.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Compteurs corrects par mois d’envoi; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## RH-008 — Sélecteur initiateur

**Priorité :** Critique  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 créées; connexion avec init.bob@example.test.  
**Jeu de données :** `REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Sélectionner un autre agent.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Comparer chaque durée, plage horaire et coefficient au barème BAREME-REC-01 approuvé par RH; calculer manuellement le montant de référence.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Uniquement opérations accessibles à initiateur; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## RH-009 — Utilisateur contrôles

**Priorité :** Critique  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « REG-2026-11-02 / EXC-2026-11-10 / barème BAREME-REC-01 » dans un état initial connu.
3. Exécuter l’action : Ouvrir contrôles RH.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Comparer chaque durée, plage horaire et coefficient au barème BAREME-REC-01 approuvé par RH; calculer manuellement le montant de référence.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Seulement ses données; pas de sélecteur; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

