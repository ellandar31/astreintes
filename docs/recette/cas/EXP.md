# Exports Excel et verrouillage (EXP)

> Cas de test manuels — exécution sur environnement de recette exclusivement.

## EXP-001 — Export par opération

**Priorité :** Critique  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée » dans un état initial connu.
3. Exécuter l’action : Exporter une opération validée.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Ouvrir le fichier Excel généré; contrôler les trois feuilles, les lignes attendues et les exclusions.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Excel téléchargé avec données exactes; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXP-002 — Export par période

**Priorité :** Critique  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée » dans un état initial connu.
3. Exécuter l’action : Exporter période contenant opérations envoyées et non envoyées.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Ouvrir le fichier Excel généré; contrôler les trois feuilles, les lignes attendues et les exclusions.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Seules envoyées figurent dans les 3 onglets; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXP-003 — Bornes inclusives

**Priorité :** Haute  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée » dans un état initial connu.
3. Exécuter l’action : Exporter avec opérations aux deux dates limites.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Ouvrir le fichier Excel généré; contrôler les trois feuilles, les lignes attendues et les exclusions.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Deux bornes incluses; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXP-004 — Ligne montant nul

**Priorité :** Haute  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée » dans un état initial connu.
3. Exécuter l’action : Exporter opération envoyée sans heure indemnisable.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Ouvrir le fichier Excel généré; contrôler les trois feuilles, les lignes attendues et les exclusions.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Ligne présente avec total zéro; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXP-005 — Envoi avant visas

**Priorité :** Critique  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée » dans un état initial connu.
3. Exécuter l’action : Tenter envoi RH sans visas complets.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Ouvrir le fichier Excel généré; contrôler les trois feuilles, les lignes attendues et les exclusions.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Envoi refusé; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXP-006 — Verrou après envoi

**Priorité :** Critique  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée créées; connexion avec init.bob@example.test.  
**Jeu de données :** `EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée » dans un état initial connu.
3. Exécuter l’action : Tenter modifier opération envoyée.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Ouvrir le fichier Excel généré; contrôler les trois feuilles, les lignes attendues et les exclusions.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Modification refusée; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXP-007 — Annulation envoi

**Priorité :** Critique  
**Profil :** RH (rh.emma@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée créées; connexion avec rh.emma@example.test.  
**Jeu de données :** `EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « RH » (rh.emma@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée » dans un état initial connu.
3. Exécuter l’action : Annuler envoi RH puis contrôler état.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Ouvrir le fichier Excel généré; contrôler les trois feuilles, les lignes attendues et les exclusions.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Statut mis à jour; modifications permises selon droits; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## EXP-008 — Export non autorisé

**Priorité :** Critique  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée créées; connexion avec init.bob@example.test.  
**Jeu de données :** `EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « EXC-2026-11-10 envoyée RH / TRV-2026-11-12 non envoyée » dans un état initial connu.
3. Exécuter l’action : Tenter accès direct export.
4. Consigner les états avant/après, les visas, dates d’envoi et/ou montants utiles à la comparaison.
5. Ouvrir le fichier Excel généré; contrôler les trois feuilles, les lignes attendues et les exclusions.
6. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
7. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Accès et génération refusés; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

