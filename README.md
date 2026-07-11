# Astreintes

Application web de gestion des astreintes, des interventions et des travaux supplémentaires destinée aux collectivités et aux services techniques.

L'objectif est de couvrir l'ensemble du cycle de vie des astreintes :

- préparation des astreintes ;
- planification des agents ;
- saisie des horaires réels ;
- validation des interventions ;
- calcul des indemnisations ;
- contrôle des règles réglementaires ;
- préparation des exports RH et Paie.

---

# Fonctionnalités

## Gestion des astreintes

L'application permet de gérer :

- les astreintes régulières ;
- les astreintes exceptionnelles ;
- les travaux supplémentaires.

Chaque fiche peut contenir :

- plusieurs agents prévus ;
- plusieurs agents réellement intervenus ;
- plusieurs interventions ;
- plusieurs validations.

---

## Gestion des interventions

Pour chaque intervention, il est possible de renseigner :

- le collaborateur ;
- la date et l'heure de début ;
- la date et l'heure de fin ;
- la présence sur site ;
- un libellé ;
- un commentaire.

---

## Validation

L'application permet de gérer les différentes étapes de validation.

Les signatures disponibles sont :

- Agent
- Initiateur
- Directeur

Les signatures peuvent être :

- dessinées directement dans l'application ;
- enregistrées dans le profil utilisateur ;
- importées sous forme d'image.

---

## Calcul RH

L'application calcule automatiquement :

### Astreintes

- indemnités de semaine ;
- indemnités samedi ;
- indemnités dimanche ;
- indemnités jours fériés.

### Interventions

Calcul selon les plages horaires :

- Semaine 18h00 → 21h00
- Nuit 21h00 → 07h00
- Semaine 07h00 → 08h00
- Samedi 07h00 → 21h00
- Dimanche / Jour férié 07h00 → 21h00

### Repos compensateurs

Les interventions peuvent être converties en repos compensateurs selon les règles définies.

---

# Module RH

Le module RH est composé de plusieurs écrans.

## Contrôles

Visualisation des compteurs réglementaires par collaborateur.

Affichage :

- heures d'astreinte ;
- nombre de week-ends réalisés ;
- jours fériés réalisés ;
- heures supplémentaires ;
- indicateurs de dépassement.

---

## Indemnisation

Calcul automatique des éléments variables de paie.

Affichage :

- coefficient d'astreinte ;
- coefficient d'intervention ;
- coefficient de travaux supplémentaires ;
- coefficient de repos compensateurs.

---

## Exports

L'application permet :

- l'export PDF des fiches RH ;
- l'export Word des fiches RH ;
- la préparation des éléments destinés à la paie (Excel).

---

# Paramétrage

L'application permet de gérer :

- les utilisateurs ;
- les équipes ;
- les jours fériés ;
- les signatures ;
- les paramètres d'indemnisation.

---

# Technologies

- Angular 19
- Firebase Authentication
- Cloud Firestore
- TypeScript

---

# Outillage

Git : https://github.com/ellandar31/astreintes
Sonar : https://sonarcloud.io/project/overview?id=ellandar31_astreintes

---

# Architecture

```
Accueil
││
├── Planification
│   ├── Astreintes
│   ├── Astreintes exceptionnelles
│   └── Travaux supplémentaires
│
├── Validation
│
├── RH
│   ├── Contrôles
│   ├── Indemnisation
│   └── Exports
│
└── Paramétrage
|    ├── Utilisateurs
|    ├── Équipes
|    ├── Jours fériés
|    └── Signatures
Profil 

```

---

# Installation

Installation des dépendances :

```bash
npm install
```

Lancement de l'application :

```bash
npm start
```

ou

```bash
ng serve
```

Compilation :

```bash
ng build
```

---

# Feuille de route

Les évolutions prévues sont notamment :

- tableau de bord RH avec compteurs réglementaires ;
- génération de documents Word personnalisables ;

---

# Licence

Projet personnel développé dans le cadre de la gestion des astreintes et des travaux exceptionnels.