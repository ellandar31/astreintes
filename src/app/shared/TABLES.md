# Tableaux partagés

Toutes les pages importent `SharedTableModule` à la place de `TableModule`.
Ce module réexporte le composant PrimeNG et applique automatiquement la directive
`SharedTableDirective` à chaque `<p-table>` : pagination visible même pour une
liste courte ou vide, 25 lignes par défaut, choix de 25, 50 ou 100 lignes.
Le menu du nombre de lignes est attaché au `body` pour ne pas être rogné
par le conteneur défilant du tableau ni y ajouter de défilement vertical.
Les pages conservent leurs colonnes, actions, tris et filtres natifs PrimeNG.

La composition par directive garde le contexte natif des templates et les
injections de `Table` utilisées par les en-têtes filtrables. Elle évite de
recopier l’API PrimeNG dans un composant intermédiaire.

La classe commune `app-data-table` applique les bordures, espacements et en-têtes
gris via les tokens de `src/styles.css`. Les classes propres aux pages servent
uniquement aux ajustements métier (largeurs, champs éditables, etc.).

Utiliser `TableRowsPipe` pour fournir une copie stable des listes du Store :
PrimeNG trie ses données en place. `TableColumnHeaderComponent` fournit les
contrôles de tri et les filtres typés. La pagination et les filtres restent un
état local de chaque tableau.
