# Travaux supplémentaires (TRV)

> Cas de test manuels — exécution sur environnement de recette exclusivement.

## TRV-001 — Création travaux

**Priorité :** Haute  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données TRV-2026-11-12 / Alice + Bruno / 12 novembre 18:00–21:00 créées; connexion avec init.bob@example.test.  
**Jeu de données :** `TRV-2026-11-12 / Alice + Bruno / 12 novembre 18:00–21:00`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « TRV-2026-11-12 / Alice + Bruno / 12 novembre 18:00–21:00 » dans un état initial connu.
3. Exécuter l’action : Créer des travaux supplémentaires avec participants.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Opération enregistrée; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## TRV-002 — Absence interventions

**Priorité :** Haute  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données TRV-2026-11-12 / Alice + Bruno / 12 novembre 18:00–21:00 créées; connexion avec init.bob@example.test.  
**Jeu de données :** `TRV-2026-11-12 / Alice + Bruno / 12 novembre 18:00–21:00`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « TRV-2026-11-12 / Alice + Bruno / 12 novembre 18:00–21:00 » dans un état initial connu.
3. Exécuter l’action : Ouvrir fiche de travaux.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Aucune intervention propre aux astreintes exceptionnelle; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## TRV-003 — Édition étrangère interdite

**Priorité :** Critique  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données TRV-2026-11-12 / Alice + Bruno / 12 novembre 18:00–21:00 créées; connexion avec init.bob@example.test.  
**Jeu de données :** `TRV-2026-11-12 / Alice + Bruno / 12 novembre 18:00–21:00`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « TRV-2026-11-12 / Alice + Bruno / 12 novembre 18:00–21:00 » dans un état initial connu.
3. Exécuter l’action : Modifier des travaux initiés par autrui.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Refus; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## TRV-004 — Périodes agents

**Priorité :** Haute  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données TRV-2026-11-12 / Alice + Bruno / 12 novembre 18:00–21:00 créées; connexion avec init.bob@example.test.  
**Jeu de données :** `TRV-2026-11-12 / Alice + Bruno / 12 novembre 18:00–21:00`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « TRV-2026-11-12 / Alice + Bruno / 12 novembre 18:00–21:00 » dans un état initial connu.
3. Exécuter l’action : Renseigner plusieurs périodes distinctes.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Périodes préservées; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

