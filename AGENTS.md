# AI Engineering Standard v1.0

## Vision Engineering

### Philosophie

Produire un logiciel maintenable. Lisibilité et transmission avant
rapidité.

### Principes

SOLID, DRY, KISS, YAGNI, Clean Code, Separation of Concerns.

### Architecture

Architecture par fonctionnalités, logique métier hors UI, store
centralisé si état partagé.

### Documentation

Documenter classes, méthodes publiques, règles métier, traitements
asynchrones non triviaux.

Le code doit rendre visibles les intentions, les contraintes métier et les
arbitrages techniques. Un code techniquement correct mais dépourvu de contexte
n'est pas considéré comme suffisamment maintenable.

Les commentaires doivent expliquer le pourquoi, les règles métier, les
dépendances entre traitements et les cas particuliers.

Les commentaires qui paraphrasent directement le code doivent être évités.

### Gestion des dépendances

Le projet doit garantir des installations reproductibles.

- Le fichier de verrouillage doit être versionné.
- La CI doit utiliser une installation déterministe.
- Les versions de Node et du gestionnaire de paquets doivent être définies.
- Les mises à jour de dépendances doivent être contrôlées et testées.
- La politique concernant les versions exactes, les tildes et les carets doit
  être documentée.

### Gestion d'état

Une stratégie de gestion d'état doit être choisie explicitement.


Les états partagés ou transverses doivent être centralisés dans le Store retenu.
Les états purement locaux doivent rester dans les composants concernés.

L'agent ne doit pas créer plusieurs mécanismes concurrents de gestion d'état.

### Design system

Les composants standards doivent être issus du design system ou de la bibliothèque UI retenue.


La recréation manuelle de boutons, formulaires, tableaux, modales ou composants
d'interaction doit être justifiée.

### Internationalisation et qualité rédactionnelle

L'internationalisation ne doit être déclarée que si elle est réellement utilisée.

Les textes affichés doivent être centralisés, correctement accentués, exempts de
fautes et conformes au vocabulaire métier du projet.

### Architecture CSS

Les tailles de police, espacements et dimensions adaptatives doivent privilégier
les unités relatives.

Les pixels restent autorisés pour les bordures et certains détails graphiques.

Le thème, les couleurs, la typographie et les espacements doivent être
centralisés sous forme de tokens.

Les fichiers de styles locaux sont autorisés, mais les styles globaux dupliqués,
les surcharges dispersées et les sélecteurs excessivement spécifiques sont
interdits.

### Revue

Architecture, documentation, sécurité, tests, UX, performances.

### Exigences

-   Le code doit expliquer les intentions et les choix.
-   Commentaires sur le pourquoi et les règles métier.
-   Dépendances reproductibles (lockfile, CI).
-   Gestion d'état documentée.
-   Design system privilégié.
-   i18n réellement utilisée ou absente.
-   Libellés relus et homogènes.
-   Design tokens et unités relatives.

## Instructions IA

-   Analyser avant de coder.
-   Réutiliser avant de créer.
-   Factoriser.
-   Séparer UI et métier.
-   Commenter les décisions.
-   Documenter les règles métier.
-   Prévoir les erreurs.
-   Faire une auto-revue finale.

## Spécificité Angular 

La bibliothèque retenu pour Angular est PrimeNG.
Le gestionnaire d'état est NgRx.

###  General Guidelines

Use idiomatic TypeScript—always prefer type safety and inference.
Use interface or type aliases to define data structures.
Always enable strict mode and follow the project's tsconfig.json.
Prefer named functions, especially for reuse and testability.
Use async/await over raw Promises and avoid .then().catch() chains.
Keep files small, focused, and well-organized.

### File Structure
Use this structure as a guide when creating or updating files:

src/
  controllers/
  services/
  repositories/
  schemas/
  middlewares/
  utils/
  config/
  types/
tests/
  unit/
  integration/

### Paterns

#### Patterns to Follow
Use Dependency Injection and Separation of Concerns.
Validate input using Zod or class-validator.
Use custom error classes for API and business logic errors.
Handle errors with centralized middleware.
Use dotenv or similar for config management.
Prefer axios or fetch with interceptors for API calls.
Structure logic around clear modules and services.

#### Patterns to Avoid
Avoid using any unless explicitly needed.
Don’t duplicate logic across controllers and services.
Avoid deeply nested callbacks or overly clever code.
Do not commit hardcoded secrets or tokens.
Avoid global state unless using scoped context providers.

### Testing Guidelines
Use Jest for unit and integration tests.
Test business logic in services; mock dependencies using ts-mockito or jest.mock for unit tests.
Use supertest for API route integration tests (Express/Nest).
Follow TDD when feasible for critical features.
Include coverage reports and snapshot testing for UI.