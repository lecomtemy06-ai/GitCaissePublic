/**
 * catalogue.js — Chargement et gestion du catalogue (articles, prix, TVA).
 *
 * Source de vérité :
 *  - si la synchronisation GitHub est configurée : le fichier
 *    catalogue.json du DÉPÔT PRIVÉ, relu à chaque démarrage (c'est la
 *    version partagée par tous les appareils) ;
 *  - sinon (première utilisation, ou synchronisation pas encore mise en
 *    place) : la copie locale (localStorage), ou à défaut le fichier
 *    statique data/catalogue.json fourni avec l'application (simple
 *    amorçage de départ).
 *
 * Chaque modification (prix, TVA, ajout, suppression, renommage) est
 * appliquée localement ET mise en file sous forme de PATCH ponctuel
 * (voir catalogue-patch.js) plutôt que comme un remplacement complet :
 * cela évite qu'un appareil écrase, par une synchronisation retardée,
 * les modifications faites entre-temps sur un autre appareil.
 */
import { CHEMIN_CATALOGUE_JSON } from './config.js';
import { Stockage } from './stockage.js';
import { fileAttendreSynchro, obtenirCatalogueDistant } from './github-sync.js';
import { appliquerPatchCatalogue } from './catalogue-patch.js';

let catalogue = null;

export async function initCatalogue() {
  const distant = await obtenirCatalogueDistant();

  if (distant) {
    catalogue = distant;
  } else {
    const local = Stockage.chargerCatalogue();
    catalogue = local || await chargerCatalogueParDefaut();
  }

  // Ré-applique les modifications faites sur CET appareil mais pas
  // encore confirmées sur GitHub (ex. faites hors-ligne), pour ne
  // jamais les faire disparaître visuellement en attendant leur tour
  // de synchronisation.
  Stockage.chargerFileSync()
    .filter(item => item.type === 'catalogue')
    .forEach(item => appliquerPatchCatalogue(catalogue, item.patch));

  Stockage.sauvegarderCatalogue(catalogue);
  return catalogue;
}

async function chargerCatalogueParDefaut() {
  try {
    const reponse = await fetch(CHEMIN_CATALOGUE_JSON, { cache: 'no-store' });
    if (!reponse.ok) throw new Error('catalogue.json introuvable');
    return await reponse.json();
  } catch (e) {
    console.warn("Impossible de charger data/catalogue.json, démarrage avec un catalogue vide.", e);
    return { categories: { "Plats": { types: {}, viandes: {} } }, supplements: {} };
  }
}

export function getCatalogue() {
  return catalogue;
}

export function getArticleRef(cat, nom) {
  if (cat === 'Plats-types') return catalogue.categories.Plats.types[nom];
  if (cat === 'Plats-viandes') return catalogue.categories.Plats.viandes[nom];
  if (cat === 'SUPPLEMENTS') return catalogue.supplements[nom];
  return catalogue.categories[cat][nom];
}

function persisterEtSynchroniser(patch) {
  appliquerPatchCatalogue(catalogue, patch);
  Stockage.sauvegarderCatalogue(catalogue);
  // Un instantané complet du catalogue local est joint au cas où le
  // fichier n'existerait pas encore du tout sur GitHub (tout premier
  // envoi) : voir github-sync.js pour son usage exact (amorçage
  // uniquement, jamais utilisé comme écrasement).
  fileAttendreSynchro({ type: 'catalogue', patch, amorce: catalogue });
}

export function modifierPrix(cat, nom, prix) {
  if (!getArticleRef(cat, nom)) return;
  persisterEtSynchroniser({ op: 'prix', cat, nom, valeur: prix });
}

export function cyclerTva(cat, nom) {
  const obj = getArticleRef(cat, nom);
  if (!obj) return;
  const cycle = [6, 12, 21];
  const i = cycle.indexOf(obj.tva);
  const valeur = cycle[(i + 1) % cycle.length];
  persisterEtSynchroniser({ op: 'tva', cat, nom, valeur });
}

export function basculerPromo(cat, nom) {
  const obj = getArticleRef(cat, nom);
  if (!obj) return;
  persisterEtSynchroniser({ op: 'promo', cat, nom, valeur: !obj.promo });
}

export function renommerArticle(cat, nomActuel, nouveauNom) {
  if (!getArticleRef(cat, nomActuel) || nouveauNom === nomActuel) return;
  persisterEtSynchroniser({ op: 'renommer', cat, nomActuel, nouveauNom });
}

export function supprimerArticle(cat, nom) {
  persisterEtSynchroniser({ op: 'supprimer', cat, nom });
}

export function ajouterArticleCatalogue(cat, nom, prix, tva, promo = false) {
  persisterEtSynchroniser({ op: 'ajouter', cat, nom, prix, tva, promo });
}
