# Organisation des pages

Chaque entrée du bandeau possède son dossier et son composant d’entrée :

| Bandeau | Dossier | Composant d’entrée |
| --- | --- | --- |
| Astreintes régulières | `regular/` | `RegularCalendarComponent` |
| Astreintes exceptionnelles | `exceptional-on-call/` | `ExceptionalOnCallPageComponent` |
| Travaux supplémentaires | `exceptional-work/` | `ExceptionalWorkPageComponent` |
| Validation | `validation/` | `ValidationPageComponent` |
| RH | `rh/` | `RhPageComponent` |
| Historique | `history/` | `HistoryPageComponent` |

`exceptional-common/` contient les listes, formulaires et modales communs aux deux
familles exceptionnelles. Les composants d’entrée fixent la famille de leur page ;
ils ne dupliquent ni le métier, ni les effets NgRx, ni la persistance.

`history/` possède sa consultation, sa modale de détail et leurs tests. `rh/` possède
les exports et leurs bibliothèques de calcul. L’historique réutilise ces calculs RH
pour afficher les mêmes coefficients que les exports, sans seconde implémentation.

Les contrats partagés restent dans `src/app/types/`, les états partagés dans
`src/app/state/` et la persistance dans `src/app/store/`. Les pages `profile/` et
`settings/` correspondent aux actions du bandeau supérieur.

Les tableaux utilisent `shared/table-column-header.component.ts` pour les menus de
filtre et les tris PrimeNG. La pipe pure `tableRows` conserve un tableau local
stable, distinct des collections NgRx, et calcule les champs de consultation
(dates, libellés, totaux). Les actions conservent l'identité de la ligne source :
un tri ou un filtre ne doit jamais modifier la cible d'une édition ou suppression.
