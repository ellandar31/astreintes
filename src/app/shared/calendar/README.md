# Calendrier mensuel partagé

Importer `CalendarComponent` depuis `shared/calendar/calendar.component` et les
contrats `CalendarEntry` et `CalendarHoliday` depuis `calendar.models`.

```html
<app-calendar
  [(month)]="displayedMonth"
  [entries]="events"
  [holidays]="holidays"
  (entryActivated)="openEvent($event)"
/>
```

- `month` / `monthChange` : mois affiché, sous forme de `Date` locale. La navigation
  émet une nouvelle valeur sans modifier la date fournie par le parent.
- `entries` : événements identifiés par `id`, avec `label`, `startDate`, `endDate`,
  `disabled` optionnel et `colorIndex` optionnel (palette de six couleurs du thème).
- `holidays` : dates calendaires `YYYY-MM-DD` et libellés à mettre en évidence.
- `disabledLegend` : explication des événements grisés, personnalisable ou masquée
  avec une chaîne vide pour un autre contexte métier.
- `entryActivated` : événement ouvert par double-clic ou au clavier. Un événement
  désactivé reste grisé et ne produit aucune activation.

La grille commence le lundi et affiche toujours six semaines. Les deux jours
limites d'un événement sont inclus. Les dates des événements sont des dates ou
dates-heures locales ; les couleurs restent stables entre les mois. Le composant
ne charge et ne modifie aucune donnée métier. Le parent conserve ses droits,
formulaires, filtres et actions NgRx et doit revérifier les droits à l'ouverture.

Les modèles de présentation sont calculés avec des signaux locaux et mémorisés ;
le store NgRx reste propriétaire des données partagées.
