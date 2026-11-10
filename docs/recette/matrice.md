# Matrice des cas de test

| ID | Domaine | Priorité | Scénario |
|---|---|---|---|
| [AUTH-001](cas/AUTH.md#auth-001--connexion-valide) | AUTH | Critique | Connexion valide |
| [AUTH-002](cas/AUTH.md#auth-002--mot-de-passe-invalide) | AUTH | Critique | Mot de passe invalide |
| [AUTH-003](cas/AUTH.md#auth-003--dconnexion) | AUTH | Critique | Déconnexion |
| [AUTH-004](cas/AUTH.md#auth-004--rafrachissement-session) | AUTH | Haute | Rafraîchissement session |
| [AUTH-005](cas/AUTH.md#auth-005--accs-anonyme) | AUTH | Critique | Accès anonyme |
| [REG-001](cas/REG.md#reg-001--cration-priode) | REG | Haute | Création période |
| [REG-002](cas/REG.md#reg-002--consultation-calendrier) | REG | Haute | Consultation calendrier |
| [REG-003](cas/REG.md#reg-003--intervention-personnelle) | REG | Haute | Intervention personnelle |
| [REG-004](cas/REG.md#reg-004--modification-planning-interdite) | REG | Critique | Modification planning interdite |
| [REG-005](cas/REG.md#reg-005--priode-invalide) | REG | Haute | Période invalide |
| [REG-006](cas/REG.md#reg-006--chevauchement-priodes) | REG | Haute | Chevauchement périodes |
| [REG-007](cas/REG.md#reg-007--modification-et-suppression) | REG | Haute | Modification et suppression |
| [EXC-001](cas/EXC.md#exc-001--cration-multi-participants) | EXC | Haute | Création multi-participants |
| [EXC-002](cas/EXC.md#exc-002--visibilit-participant) | EXC | Critique | Visibilité participant |
| [EXC-003](cas/EXC.md#exc-003--modification-opration-propre) | EXC | Haute | Modification opération propre |
| [EXC-004](cas/EXC.md#exc-004--modification-opration-trangre) | EXC | Critique | Modification opération étrangère |
| [EXC-005](cas/EXC.md#exc-005--intervention-hors-priode-relle) | EXC | Critique | Intervention hors période réelle |
| [EXC-006](cas/EXC.md#exc-006--intervention-autre-agent) | EXC | Critique | Intervention autre agent |
| [EXC-007](cas/EXC.md#exc-007--priodes-multiples) | EXC | Haute | Périodes multiples |
| [EXC-008](cas/EXC.md#exc-008--suppression-opration) | EXC | Haute | Suppression opération |
| [TRV-001](cas/TRV.md#trv-001--cration-travaux) | TRV | Haute | Création travaux |
| [TRV-002](cas/TRV.md#trv-002--absence-interventions) | TRV | Haute | Absence interventions |
| [TRV-003](cas/TRV.md#trv-003--dition-trangre-interdite) | TRV | Critique | Édition étrangère interdite |
| [TRV-004](cas/TRV.md#trv-004--priodes-agents) | TRV | Haute | Périodes agents |
| [VAL-001](cas/VAL.md#val-001--visa-agent) | VAL | Critique | Visa agent |
| [VAL-002](cas/VAL.md#val-002--visa-autre-agent) | VAL | Critique | Visa autre agent |
| [VAL-003](cas/VAL.md#val-003--visa-initiateur-sur-propre-opration) | VAL | Critique | Visa initiateur sur propre opération |
| [VAL-004](cas/VAL.md#val-004--visa-initiateur-opration-trangre) | VAL | Critique | Visa initiateur opération étrangère |
| [VAL-005](cas/VAL.md#val-005--approbation-prmature) | VAL | Critique | Approbation prématurée |
| [VAL-006](cas/VAL.md#val-006--approbation-complte) | VAL | Critique | Approbation complète |
| [VAL-007](cas/VAL.md#val-007--retrait-visa-pralable) | VAL | Critique | Retrait visa préalable |
| [VAL-008](cas/VAL.md#val-008--retrait-visa-autre-signataire) | VAL | Critique | Retrait visa autre signataire |
| [VAL-009](cas/VAL.md#val-009--visa-global-agent) | VAL | Haute | Visa global agent |
| [VAL-010](cas/VAL.md#val-010--parit-rh-directeur) | VAL | Critique | Parité RH directeur |
| [RH-001](cas/RH.md#rh-001--calcul-semaine) | RH | Critique | Calcul semaine |
| [RH-002](cas/RH.md#rh-002--calcul-samedi) | RH | Critique | Calcul samedi |
| [RH-003](cas/RH.md#rh-003--calcul-dimanche-et-fri) | RH | Critique | Calcul dimanche et férié |
| [RH-004](cas/RH.md#rh-004--dcoupage-horaires-nuit) | RH | Critique | Découpage horaires nuit |
| [RH-005](cas/RH.md#rh-005--passage-minuit) | RH | Critique | Passage minuit |
| [RH-006](cas/RH.md#rh-006--repos-compensateur) | RH | Haute | Repos compensateur |
| [RH-007](cas/RH.md#rh-007--contrles-mensuels) | RH | Critique | Contrôles mensuels |
| [RH-008](cas/RH.md#rh-008--slecteur-initiateur) | RH | Critique | Sélecteur initiateur |
| [RH-009](cas/RH.md#rh-009--utilisateur-contrles) | RH | Critique | Utilisateur contrôles |
| [EXP-001](cas/EXP.md#exp-001--export-par-opration) | EXP | Critique | Export par opération |
| [EXP-002](cas/EXP.md#exp-002--export-par-priode) | EXP | Critique | Export par période |
| [EXP-003](cas/EXP.md#exp-003--bornes-inclusives) | EXP | Haute | Bornes inclusives |
| [EXP-004](cas/EXP.md#exp-004--ligne-montant-nul) | EXP | Haute | Ligne montant nul |
| [EXP-005](cas/EXP.md#exp-005--envoi-avant-visas) | EXP | Critique | Envoi avant visas |
| [EXP-006](cas/EXP.md#exp-006--verrou-aprs-envoi) | EXP | Critique | Verrou après envoi |
| [EXP-007](cas/EXP.md#exp-007--annulation-envoi) | EXP | Critique | Annulation envoi |
| [EXP-008](cas/EXP.md#exp-008--export-non-autoris) | EXP | Critique | Export non autorisé |
| [PAR-001](cas/PAR.md#par-001--cration-utilisateur) | PAR | Critique | Création utilisateur |
| [PAR-002](cas/PAR.md#par-002--changement-rle) | PAR | Critique | Changement rôle |
| [PAR-003](cas/PAR.md#par-003--changement-rle-interdit) | PAR | Critique | Changement rôle interdit |
| [PAR-004](cas/PAR.md#par-004--gestion-quipes) | PAR | Haute | Gestion équipes |
| [PAR-005](cas/PAR.md#par-005--jours-fris) | PAR | Haute | Jours fériés |
| [PAR-006](cas/PAR.md#par-006--coefficients) | PAR | Critique | Coefficients |
| [PAR-007](cas/PAR.md#par-007--coefficients-non-admin) | PAR | Critique | Coefficients non admin |
| [PRO-001](cas/PRO.md#pro-001--modification-nom) | PRO | Haute | Modification nom |
| [PRO-002](cas/PRO.md#pro-002--signature-dessine) | PRO | Haute | Signature dessinée |
| [PRO-003](cas/PRO.md#pro-003--signature-importe) | PRO | Moyenne | Signature importée |
| [PRO-004](cas/PRO.md#pro-004--modification-autre-profil) | PRO | Critique | Modification autre profil |
| [SEC-001](cas/SEC.md#sec-001--accs-crois-aux-donnes) | SEC | Critique | Accès croisé aux données |
| [SEC-002](cas/SEC.md#sec-002--droits-aprs-changement-rle) | SEC | Critique | Droits après changement rôle |
| [SEC-003](cas/SEC.md#sec-003--accs-url-export-direct) | SEC | Critique | Accès URL export direct |
| [SEC-004](cas/SEC.md#sec-004--double-soumission) | SEC | Haute | Double soumission |
| [SEC-005](cas/SEC.md#sec-005--conflit-multi-session) | SEC | Haute | Conflit multi-session |
| [SEC-006](cas/SEC.md#sec-006--persistance-rechargement) | SEC | Haute | Persistance rechargement |
| [IHM-001](cas/IHM.md#ihm-001--navigation) | IHM | Moyenne | Navigation |
| [IHM-002](cas/IHM.md#ihm-002--affichage-mobile) | IHM | Moyenne | Affichage mobile |
| [IHM-003](cas/IHM.md#ihm-003--erreurs-saisie) | IHM | Haute | Erreurs saisie |
| [IHM-004](cas/IHM.md#ihm-004--perte-rseau) | IHM | Haute | Perte réseau |
