/**
 * github-sync.js — Synchronisation en arrière-plan des ventes, clôtures
 * et du catalogue vers/depuis un dépôt GitHub privé, via l'API REST.
 *
 * Deux directions :
 *  - ÉCRITURE (file d'attente) : chaque vente/clôture/modification de
 *    catalogue locale est ajoutée à une file. Cette file est vidée dès
 *    qu'une connexion est disponible ; en cas d'échec (hors-ligne,
 *    conflit), l'élément reste en attente et sera retenté automatiquement.
 *    Une vente n'est donc JAMAIS bloquée par une coupure internet.
 *  - LECTURE (à la demande) : d'autres modules (catalogue.js, ventes.js,
 *    cloture.js) peuvent aller chercher l'état actuel du dépôt privé,
 *    qui est la version partagée par tous les appareils.
 *
 * Le catalogue est synchronisé par PATCHS ponctuels (voir
 * catalogue-patch.js), jamais par remplacement intégral : cela évite
 * qu'un appareil, en synchronisant en retard sa propre copie, efface les
 * modifications faites entre-temps par un autre appareil. Les ventes et
 * clôtures, elles, sont fusionnées par numéro de ticket / par date.
 */
import { Stockage } from './stockage.js';
import { TAILLE_BLOC_TICKETS } from './config.js';
import { appliquerPatchCatalogue, decrirePatch } from './catalogue-patch.js';

const API_BASE = 'https://api.github.com';
const MAX_ESSAIS_CONFLIT = 5;

let enTraitement = false;
const ecouteursStatut = [];

// ===== Statut (pour l'affichage d'une pastille dans l'UI) =====
export function onStatutChange(fn) {
  ecouteursStatut.push(fn);
}

function notifierStatut() {
  const config = Stockage.chargerConfigGithub();
  const file = Stockage.chargerFileSync();
  const statut = {
    configure: estConfigure(config),
    enAttente: file.length,
    enTraitement
  };
  ecouteursStatut.forEach(fn => fn(statut));
}

function estConfigure(config) {
  return !!(config && config.token && config.owner && config.repo);
}

// ===== Configuration =====
export function getConfigGithub() {
  return Stockage.chargerConfigGithub();
}

export function sauvegarderConfigGithub(config) {
  Stockage.sauvegarderConfigGithub(config);
  notifierStatut();
  traiterFile();
}

export async function testerConnexionGithub(config) {
  try {
    const reponse = await fetch(`${API_BASE}/repos/${config.owner}/${config.repo}`, { headers: enTetes(config) });
    if (reponse.ok) return { ok: true };
    if (reponse.status === 404) return { ok: false, message: 'Dépôt introuvable (vérifiez le propriétaire et le nom)' };
    if (reponse.status === 401 || reponse.status === 403) return { ok: false, message: 'Jeton invalide ou droits insuffisants' };
    return { ok: false, message: `Erreur ${reponse.status}` };
  } catch (e) {
    return { ok: false, message: 'Impossible de contacter GitHub (hors-ligne ?)' };
  }
}

// ===== File d'attente (écriture) =====
export function fileAttendreSynchro(item) {
  const file = Stockage.chargerFileSync();
  file.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2), tentatives: 0, ...item });
  Stockage.sauvegarderFileSync(file);
  notifierStatut();
  traiterFile();
}

export async function traiterFile() {
  if (enTraitement) return;
  const config = Stockage.chargerConfigGithub();
  if (!estConfigure(config)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  enTraitement = true;
  notifierStatut();

  let file = Stockage.chargerFileSync();
  while (file.length) {
    const item = file[0];
    try {
      await traiterUnElement(config, item);
      file.shift();
      Stockage.sauvegarderFileSync(file);
      notifierStatut();
    } catch (e) {
      item.tentatives = (item.tentatives || 0) + 1;
      Stockage.sauvegarderFileSync(file);
      console.warn('Synchronisation GitHub différée :', e.message || e);
      break; // on réessaiera au prochain déclenchement
    }
  }

  enTraitement = false;
  notifierStatut();
}

async function traiterUnElement(config, item) {
  if (item.type === 'vente') return synchroniserVente(config, item);
  if (item.type === 'cloture') return synchroniserCloture(config, item);
  if (item.type === 'catalogue') return synchroniserCatalogue(config, item);
}

// Un fichier par jour (ventes/AAAA-MM-JJ.json) : on relit la version la
// plus fraîche, on ajoute le ticket s'il n'y est pas déjà, puis on
// réécrit. En cas de conflit (un autre appareil a écrit entre-temps),
// on relit et on retente.
async function synchroniserVente(config, item) {
  const chemin = `ventes/${item.date}.json`;
  for (let essai = 0; essai < MAX_ESSAIS_CONFLIT; essai++) {
    const distant = await githubGetFile(config, chemin);
    let tableau = [];
    if (distant.existe) {
      try { tableau = JSON.parse(distant.contenu); } catch { tableau = []; }
    }
    if (!tableau.some(t => t.numero === item.ticket.numero)) {
      tableau.push(item.ticket);
      tableau.sort((a, b) => a.horodatage.localeCompare(b.horodatage));
    }
    try {
      await githubPutFile(config, chemin, JSON.stringify(tableau, null, 2), distant.sha,
        `Vente - ticket n°${item.ticket.numero} (${item.date})`);
      return;
    } catch (e) {
      if (e.status === 409 || e.status === 422) continue; // conflit -> nouvelle tentative
      throw e;
    }
  }
  throw new Error('Trop de tentatives de synchronisation (vente)');
}

// Un fichier par jour (clotures/AAAA-MM-JJ.json), remplacé entièrement
// à chaque clôture (peu de risque de concurrence : une seule clôture
// par jour, déclenchée volontairement, et qui agrège déjà toutes les
// ventes connues au moment où elle est faite).
async function synchroniserCloture(config, item) {
  const chemin = `clotures/${item.date}.json`;
  const distant = await githubGetFile(config, chemin);
  await githubPutFile(config, chemin, JSON.stringify(item.cloture, null, 2), distant.sha,
    `Clôture - ${item.date}`);
}

// Fichier unique catalogue.json. Contrairement aux ventes/clôtures, on
// n'écrase JAMAIS le contenu distant : on applique le PATCH ponctuel
// (ex. "prix de X -> 5€") à la version la plus fraîche du fichier,
// quelles que soient les autres modifications qui s'y trouvent déjà.
// Si le fichier n'existe pas encore du tout sur GitHub (tout premier
// envoi), on l'amorce avec l'instantané complet fourni par l'appareil.
async function synchroniserCatalogue(config, item) {
  const chemin = 'catalogue.json';
  for (let essai = 0; essai < MAX_ESSAIS_CONFLIT; essai++) {
    const distant = await githubGetFile(config, chemin);
    let catalogueDistant = null;
    if (distant.existe) {
      try { catalogueDistant = JSON.parse(distant.contenu); } catch { catalogueDistant = null; }
    }
    if (!catalogueDistant) {
      catalogueDistant = item.amorce || { categories: {}, supplements: {} };
    }
    appliquerPatchCatalogue(catalogueDistant, item.patch);
    try {
      await githubPutFile(config, chemin, JSON.stringify(catalogueDistant, null, 2), distant.sha,
        decrirePatch(item.patch));
      return;
    } catch (e) {
      if (e.status === 409 || e.status === 422) continue;
      throw e;
    }
  }
  throw new Error('Trop de tentatives de synchronisation (catalogue)');
}

// ===== Lecture à la demande (dépôt privé = source partagée) =====

// Réserve atomiquement un bloc de numéros de tickets auprès du fichier
// partagé compteur.json (source de vérité unique de "quel est le
// prochain numéro libre pour toute l'entreprise"). Utilise le même
// mécanisme de nouvelle tentative en cas de conflit que le reste de ce
// module : deux appareils réservant en même temps ne peuvent jamais
// recevoir le même bloc. Renvoie null si non configuré, hors-ligne, ou
// après échec de toutes les tentatives (l'appelant doit alors se
// rabattre sur une numérotation de secours, voir numerotation.js).
export async function reserverBlocTickets() {
  const config = Stockage.chargerConfigGithub();
  if (!estConfigure(config)) return null;
  const chemin = 'compteur.json';
  for (let essai = 0; essai < MAX_ESSAIS_CONFLIT; essai++) {
    let distant;
    try {
      distant = await githubGetFile(config, chemin);
    } catch (e) {
      return null;
    }
    let compteur = { prochain: 1 };
    if (distant.existe) {
      try { compteur = JSON.parse(distant.contenu); } catch { compteur = { prochain: 1 }; }
    }
    const debut = compteur.prochain;
    const fin = debut + TAILLE_BLOC_TICKETS - 1;
    try {
      await githubPutFile(config, chemin, JSON.stringify({ prochain: fin + 1 }, null, 2), distant.sha,
        `Réservation bloc de tickets ${debut}-${fin}`);
      return { debut, fin };
    } catch (e) {
      if (e.status === 409 || e.status === 422) continue;
      return null;
    }
  }
  return null;
}

export async function obtenirCatalogueDistant() {
  const config = Stockage.chargerConfigGithub();
  if (!estConfigure(config)) return null;
  try {
    const distant = await githubGetFile(config, 'catalogue.json');
    if (!distant.existe) return null;
    return JSON.parse(distant.contenu);
  } catch (e) {
    console.warn('Catalogue distant inaccessible, utilisation de la copie locale', e);
    return null;
  }
}

export async function obtenirVentesDistantes(date) {
  const config = Stockage.chargerConfigGithub();
  if (!estConfigure(config)) return null;
  try {
    const distant = await githubGetFile(config, `ventes/${date}.json`);
    if (!distant.existe) return [];
    return JSON.parse(distant.contenu);
  } catch (e) {
    console.warn('Ventes distantes inaccessibles pour ' + date, e);
    return null;
  }
}

export async function obtenirClotureDistante(date) {
  const config = Stockage.chargerConfigGithub();
  if (!estConfigure(config)) return null;
  try {
    const distant = await githubGetFile(config, `clotures/${date}.json`);
    if (!distant.existe) return null;
    return JSON.parse(distant.contenu);
  } catch (e) {
    console.warn('Clôture distante inaccessible pour ' + date, e);
    return null;
  }
}

// Liste les fichiers .json d'un dossier du dépôt privé (ex. "ventes",
// "clotures"), en renvoyant leurs noms sans l'extension (ex. dates).
// Renvoie null si non configuré/hors-ligne (pour distinguer d'une
// liste simplement vide).
export async function listerFichiersDistants(dossier) {
  const config = Stockage.chargerConfigGithub();
  if (!estConfigure(config)) return null;
  try {
    const url = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${dossier}`;
    const reponse = await fetch(url, { headers: enTetes(config) });
    if (reponse.status === 404) return [];
    if (!reponse.ok) throw new Error(`Listing GitHub échoué (${reponse.status})`);
    const data = await reponse.json();
    return data
      .filter(f => f.type === 'file' && f.name.endsWith('.json'))
      .map(f => f.name.replace(/\.json$/, ''));
  } catch (e) {
    console.warn('Listing distant impossible pour ' + dossier, e);
    return null;
  }
}

// ===== Appels bruts à l'API GitHub =====
function enTetes(config) {
  return {
    'Authorization': `Bearer ${config.token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function texteVersBase64(texte) {
  return btoa(unescape(encodeURIComponent(texte)));
}

function base64VersTexte(base64) {
  return decodeURIComponent(escape(atob(base64.replace(/\n/g, ''))));
}

async function githubGetFile(config, chemin) {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${chemin}`;
  const reponse = await fetch(url, { headers: enTetes(config) });
  if (reponse.status === 404) return { existe: false, sha: null, contenu: null };
  if (!reponse.ok) {
    const err = new Error(`Lecture GitHub échouée (${reponse.status})`);
    err.status = reponse.status;
    throw err;
  }
  const data = await reponse.json();
  return { existe: true, sha: data.sha, contenu: base64VersTexte(data.content) };
}

async function githubPutFile(config, chemin, contenuTexte, sha, message) {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${chemin}`;
  const corps = {
    message,
    content: texteVersBase64(contenuTexte),
    ...(sha ? { sha } : {})
  };
  const reponse = await fetch(url, {
    method: 'PUT',
    headers: { ...enTetes(config), 'Content-Type': 'application/json' },
    body: JSON.stringify(corps)
  });
  if (!reponse.ok) {
    const err = new Error(`Écriture GitHub échouée (${reponse.status})`);
    err.status = reponse.status;
    throw err;
  }
  return reponse.json();
}

// ===== Déclencheurs automatiques =====
if (typeof window !== 'undefined') {
  window.addEventListener('online', traiterFile);
  setInterval(traiterFile, 60000);
}
