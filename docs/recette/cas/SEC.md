# Sécurité fonctionnelle et isolation (SEC)

> Cas de test manuels — exécution sur environnement de recette exclusivement.

## SEC-001 — Accès croisé aux données

**Priorité :** Critique  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données Alice participante / Chloé non participante / 2 sessions distinctes créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `Alice participante / Chloé non participante / 2 sessions distinctes`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Alice participante / Chloé non participante / 2 sessions distinctes » dans un état initial connu.
3. Exécuter l’action : Comparer opérations visibles avec compte non participant.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Répéter la tentative depuis une deuxième session sans droit et relever tout accès inattendu.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Aucune opération étrangère exposée dans IHM; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## SEC-002 — Droits après changement rôle

**Priorité :** Critique  
**Profil :** Administrateur (admin.recette@example.test)  
**Préconditions :** Environnement de recette isolé; données Alice participante / Chloé non participante / 2 sessions distinctes créées; connexion avec admin.recette@example.test.  
**Jeu de données :** `Alice participante / Chloé non participante / 2 sessions distinctes`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Administrateur » (admin.recette@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Alice participante / Chloé non participante / 2 sessions distinctes » dans un état initial connu.
3. Exécuter l’action : Révoquer droit durant session d’un autre compte.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Répéter la tentative depuis une deuxième session sans droit et relever tout accès inattendu.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Actions privilégiées indisponibles après actualisation; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## SEC-003 — Accès URL export direct

**Priorité :** Critique  
**Profil :** Utilisateur (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données Alice participante / Chloé non participante / 2 sessions distinctes créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `Alice participante / Chloé non participante / 2 sessions distinctes`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Utilisateur » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Alice participante / Chloé non participante / 2 sessions distinctes » dans un état initial connu.
3. Exécuter l’action : Ouvrir URL/rubrique export directement.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Répéter la tentative depuis une deuxième session sans droit et relever tout accès inattendu.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Refus; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## SEC-004 — Double soumission

**Priorité :** Haute  
**Profil :** Initiateur (init.bob@example.test)  
**Préconditions :** Environnement de recette isolé; données Alice participante / Chloé non participante / 2 sessions distinctes créées; connexion avec init.bob@example.test.  
**Jeu de données :** `Alice participante / Chloé non participante / 2 sessions distinctes`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Initiateur » (init.bob@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Alice participante / Chloé non participante / 2 sessions distinctes » dans un état initial connu.
3. Exécuter l’action : Double-cliquer sauvegarde opération.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Répéter la tentative depuis une deuxième session sans droit et relever tout accès inattendu.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Pas de doublon; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## SEC-005 — Conflit multi-session

**Priorité :** Haute  
**Profil :** Directeur (direction.diane@example.test)  
**Préconditions :** Environnement de recette isolé; données Alice participante / Chloé non participante / 2 sessions distinctes créées; connexion avec direction.diane@example.test.  
**Jeu de données :** `Alice participante / Chloé non participante / 2 sessions distinctes`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Directeur » (direction.diane@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Alice participante / Chloé non participante / 2 sessions distinctes » dans un état initial connu.
3. Exécuter l’action : Modifier même fiche depuis deux sessions.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Répéter la tentative depuis une deuxième session sans droit et relever tout accès inattendu.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Comportement cohérent, pas de perte silencieuse; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

## SEC-006 — Persistance rechargement

**Priorité :** Haute  
**Profil :** Tous (agent.alice@example.test)  
**Préconditions :** Environnement de recette isolé; données Alice participante / Chloé non participante / 2 sessions distinctes créées; connexion avec agent.alice@example.test.  
**Jeu de données :** `Alice participante / Chloé non participante / 2 sessions distinctes`

**Procédure**

1. Ouvrir l’application de recette et se connecter avec le profil « Tous » (agent.alice@example.test), sauf cas anonyme.
2. Préparer ou vérifier le jeu de données « Alice participante / Chloé non participante / 2 sessions distinctes » dans un état initial connu.
3. Exécuter l’action : Modifier une fiche puis recharger.
4. Observer les messages, les habilitations, les changements d’état et les éventuels totaux affichés.
5. Répéter la tentative depuis une deuxième session sans droit et relever tout accès inattendu.
6. Actualiser la page puis rouvrir l’objet; contrôler la persistance et les données visibles.

**Résultat attendu :** Données enregistrées retrouvées; aucune erreur technique non maîtrisée; contrôle après rechargement cohérent.

**Preuves à conserver :** capture avant/après, référence de l’objet, journal d’anomalie si KO.

---

