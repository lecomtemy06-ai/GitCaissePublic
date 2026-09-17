# Caisse — Friterie de L'Ancienne Gare

Application de caisse enregistreuse conforme à la législation belge sur
les tickets de caisse (TVA ventilée par taux, numérotation continue,
identité de l'entreprise), avec synchronisation en temps réel vers un
dépôt GitHub privé.

## Architecture en un coup d'œil

Deux dépôts GitHub séparés, avec des rôles bien distincts :

| Dépôt | Contenu | Visibilité | Rôle |
|---|---|---|---|
| **Ce dépôt (public)** | Le code de l'application uniquement | Public (obligatoire pour GitHub Pages gratuit) | Hébergement du site |
| **Dépôt privé** (à créer à part) | `catalogue.json`, `ventes/*.json`, `clotures/*.json` | Privé, gratuit | Sauvegarde des données en temps réel |

**Aucune donnée de vente ne se trouve jamais dans ce dépôt.** Le code
ne contient que la logique de l'application ; les ventes réelles ne
sont écrites que dans le dépôt privé (via l'API GitHub, en tâche de
fond) et dans le navigateur de chaque appareil (localStorage, pour un
fonctionnement garanti même hors-ligne).

## Déployer ce dépôt sur GitHub Pages

1. Crée un dépôt **public** sur GitHub et mets-y tout le contenu de ce
   dossier (`index.html` doit rester à la racine du dépôt).
2. Dans **Settings → Pages**, source = "Deploy from a branch", branche
   `main`, dossier `/ (root)`.
3. Ton app est en ligne à `https://<ton-nom-utilisateur>.github.io/<nom-du-depot>/`.

## Configurer la synchronisation vers le dépôt privé

Voir `depot-prive-modele/README.md` pour la marche à suivre complète
(création du dépôt privé, génération du jeton d'accès, configuration
dans l'app via **Gestion des prix → ⚙️ Paramètres**).

## Structure du code

```
index.html                 Structure HTML uniquement (aucune logique)
manifest.json               Identité de l'app installable (PWA)
service-worker.js           Mise en cache pour le fonctionnement hors-ligne
assets/css/style.css        Tous les styles
assets/icons/               Icônes de l'app
data/catalogue.json         Catalogue par défaut (prix, TVA) — modifiable
                             directement ici ou depuis l'app

js/
  config.js                 Constantes : société, clés de stockage, mot de passe
  stockage.js                Seul point d'accès au localStorage
  catalogue.js                Chargement du catalogue (dépôt privé en priorité)
                               + gestion des prix/TVA
  catalogue-patch.js           Applique un correctif ponctuel à un catalogue
                                (partagé entre l'usage local et la synchro)
  panier.js                    État du panier de la vente en cours
  calculatrice.js               Logique de la calculette ("Montant libre")
  ticket.js                      Calcul TVA + mise en forme du ticket légal
                                  (fonctions pures, sans DOM)
  ventes.js                       Sauvegarde d'une vente, lecture de l'historique
  numerotation.js                  Attribution des numéros de ticket (blocs partagés)
  cloture.js                       Calcul et sauvegarde de la clôture journalière
  export.js                         Export CSV/JSON, restauration, dossier local
  github-sync.js                     Synchronisation temps réel vers le dépôt privé
  clavier.js                          Pavé numérique et clavier AZERTY réutilisables
  ui-modal.js                          Moteur générique de fenêtres modales
  ui-menu.js                            Navigation du menu de vente + panier
  ui-paiement.js                         Écran de paiement et reçu
  ui-historique.js                        Historique du jour et clôtures
  ui-export.js                             Écran Export & Sauvegarde
  ui-gestion.js                             Écran Gestion des prix (protégé)
  ui-parametres.js                          Configuration de la synchro GitHub
  app.js                                    Point d'entrée, démarre tout
```

## Où sont stockées les données ?

1. **En premier lieu, toujours en local** (localStorage du navigateur) —
   la caisse fonctionne intégralement hors-ligne, aucune vente n'est
   jamais bloquée par une coupure internet.
2. **En tâche de fond**, chaque vente/clôture/modification de prix est
   envoyée au dépôt privé GitHub dès qu'une connexion est disponible.
   En cas d'échec, l'élément reste en file d'attente et sera retenté
   automatiquement (retour en ligne, ou toutes les 60 secondes).
3. **En bonus (Chrome/Edge PC et Android uniquement)**, un dossier local
   peut aussi être choisi (bouton **Export**) pour une copie
   supplémentaire automatique sur le disque de l'appareil.

Au démarrage, si la synchronisation GitHub est configurée, l'app relit
le catalogue **depuis le dépôt privé** (la version partagée par tous les
appareils), pas depuis le fichier statique `data/catalogue.json` de ce
dépôt public (qui ne sert qu'à amorcer un tout premier appareil n'ayant
jamais été connecté à GitHub).

## Synchronisation multi-appareils : comment les conflits sont évités

- **Catalogue** : chaque modification (prix, TVA, ajout, suppression,
  renommage) est envoyée comme un **correctif ponctuel** ("le prix de X
  passe à 5€"), jamais comme un remplacement intégral du fichier. Ce
  correctif est appliqué à la version la PLUS RÉCENTE du fichier sur
  GitHub au moment de l'envoi — les modifications faites entre-temps par
  un autre appareil ne sont donc jamais écrasées.
- **Numéro de ticket** : les appareils réservent ensemble, auprès du
  dépôt privé, des **blocs de 100 numéros** (ex. 1-100, 101-200...) de
  façon atomique — jamais deux appareils avec le même bloc. Chaque
  appareil consomme ensuite localement les numéros de son bloc, sans
  appel réseau à chaque vente : la numérotation reste quasi continue
  pour toute l'entreprise (`000001`, `000002`...), avec parfois un saut
  entre deux blocs selon quel appareil vend à quel moment, mais jamais
  de doublon ni de vente bloquée par une coupure internet. Un nouveau
  bloc est réservé en tâche de fond dès qu'un appareil entame les
  derniers 20% du sien. Dans le cas rare où un appareil épuiserait
  malgré tout son bloc alors qu'il est hors-ligne, il continue de
  vendre avec une numérotation de secours qui lui est propre
  (`<identifiant>-SECOURS-000001`...), qui ne peut par construction
  jamais entrer en collision avec la séquence partagée, et qui laisse
  la main dès la reconnexion.
- **Ventes/clôtures** : l'Historique et la Liste des clôtures consultent
  le dépôt privé en plus des données locales, pour qu'une machine voie
  l'activité de toutes les autres.

## Modifier la société ou le mot de passe de gestion

Tout se trouve dans `js/config.js` — un seul endroit à modifier.
