# Droits de visa dans la validation

Les droits d'action sont vérifiés sur chaque ligne, indépendamment du filtrage
existant de la page et des détails de consultation.

- Administrateur : accès à toutes les actions, y compris le retrait de tout visa.
- Utilisateur : signature des seules lignes associées à son identité applicative.
- Initiateur : mêmes droits personnels, plus signature des lignes participantes
  (prévisionnel, réel et interventions) des opérations qu'il a initiées.
- Directeur : signature de toutes les lignes.

Les lignes d'approbation directeur sont réservées aux administrateurs et directeurs.
Les prérequis d'approbation, l'interdiction de signer un visa déjà signé et le
verrouillage après envoi aux RH restent applicables.

Un initiateur ou directeur délégué applique sa propre signature : le visa conserve
l'identité réelle du signataire. La substitution administrative historique est
conservée. Hors administration, le retrait exige d'être autorisé sur la ligne et
d'être le signataire du visa.

Cette règle concerne les contrôles de la page Angular (boutons, consultation et
appels directs). Les politiques SQL spécifiques aux visas restent un chantier
séparé, comme documenté dans planning-intervention-security.md.

Vérification : tests Jest de validation avec les quatre profils, les deux familles
exceptionnelles, refus des appels directs, identité du signataire et prérequis.
