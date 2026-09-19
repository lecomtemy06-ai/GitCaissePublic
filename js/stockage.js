/**
 * stockage.js — Point d'accès UNIQUE au localStorage du navigateur.
 * Aucun autre module ne doit appeler localStorage directement :
 * cela permet de faire évoluer la stratégie de stockage plus tard
 * sans avoir à modifier le reste du code.
 */
import { CLES_STOCKAGE } from './config.js';

function lire(cle, defaut) {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? JSON.parse(brut) : defaut;
  } catch (e) {
    console.warn('Lecture locale échouée pour', cle, e);
    return defaut;
  }
}

function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch (e) {
    console.warn('Écriture locale échouée pour', cle, e);
    return false;
  }
}

function genererIdentifiantAleatoire() {
  // Sans caractères ambigus (0/O, 1/I) pour rester lisible sur un ticket imprimé
  const car = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += car[Math.floor(Math.random() * car.length)];
  return s;
}

export const Stockage = {
  chargerCatalogue: () => lire(CLES_STOCKAGE.CATALOGUE, null),
  sauvegarderCatalogue: (c) => ecrire(CLES_STOCKAGE.CATALOGUE, c),

  chargerVentes: () => lire(CLES_STOCKAGE.VENTES, []),
  sauvegarderVentes: (v) => ecrire(CLES_STOCKAGE.VENTES, v),

  chargerClotures: () => lire(CLES_STOCKAGE.CLOTURES, {}),
  sauvegarderClotures: (c) => ecrire(CLES_STOCKAGE.CLOTURES, c),

  // Bloc de numéros de tickets actuellement en cours de consommation
  // par cet appareil : { debut, fin, prochain }. Voir numerotation.js.
  chargerBlocTickets: () => lire(CLES_STOCKAGE.BLOC_TICKETS, null),
  sauvegarderBlocTickets: (b) => ecrire(CLES_STOCKAGE.BLOC_TICKETS, b),

  // Bloc suivant, réservé à l'avance en tâche de fond avant épuisement
  // du bloc courant, prêt à prendre le relais sans appel réseau.
  chargerBlocEnAttente: () => lire(CLES_STOCKAGE.BLOC_TICKETS_ATTENTE, null),
  sauvegarderBlocEnAttente: (b) => ecrire(CLES_STOCKAGE.BLOC_TICKETS_ATTENTE, b),
  effacerBlocEnAttente: () => localStorage.removeItem(CLES_STOCKAGE.BLOC_TICKETS_ATTENTE),

  // Filet de sécurité : compteur strictement local, utilisé uniquement
  // si cet appareil épuise son bloc partagé alors qu'il est hors-ligne.
  chargerCompteurSecours: () => {
    const v = parseInt(localStorage.getItem(CLES_STOCKAGE.COMPTEUR_SECOURS), 10);
    return isNaN(v) ? 1 : v;
  },
  sauvegarderCompteurSecours: (n) => {
    localStorage.setItem(CLES_STOCKAGE.COMPTEUR_SECOURS, String(n));
  },

  chargerFileSync: () => lire(CLES_STOCKAGE.FILE_SYNC, []),
  sauvegarderFileSync: (f) => ecrire(CLES_STOCKAGE.FILE_SYNC, f),

  // Jeton d'accès GitHub de CET appareil (propriétaire et nom du dépôt
  // sont fixés dans config.js — voir DEPOT_PRIVE — car non sensibles).
  // Migre automatiquement l'ancien format (propriétaire+dépôt+jeton
  // stockés ensemble) si trouvé, pour ne rien casser après une mise à
  // jour de l'app.
  chargerTokenGithub: () => {
    const token = localStorage.getItem(CLES_STOCKAGE.TOKEN_GITHUB);
    if (token) return token;
    const ancien = lire(CLES_STOCKAGE.GITHUB_CONFIG, null);
    if (ancien && ancien.token) {
      localStorage.setItem(CLES_STOCKAGE.TOKEN_GITHUB, ancien.token);
      localStorage.removeItem(CLES_STOCKAGE.GITHUB_CONFIG);
      return ancien.token;
    }
    return null;
  },
  sauvegarderTokenGithub: (token) => localStorage.setItem(CLES_STOCKAGE.TOKEN_GITHUB, token),

  // Identifiant unique de CET appareil. Utilisé (1) comme métadonnée de
  // traçabilité sur chaque ticket ("quel appareil a vendu ceci"), et (2)
  // comme préfixe de la numérotation de secours si cet appareil doit
  // vendre hors-ligne après avoir épuisé son bloc de numéros partagé
  // (voir numerotation.js). Généré automatiquement au premier lancement
  // si l'utilisateur n'en a pas choisi un lui-même.
  chargerIdentifiantCaisse: () => localStorage.getItem(CLES_STOCKAGE.IDENTIFIANT_CAISSE),
  definirIdentifiantCaisse: (id) => localStorage.setItem(CLES_STOCKAGE.IDENTIFIANT_CAISSE, id),
  obtenirOuGenererIdentifiantCaisse: () => {
    let id = localStorage.getItem(CLES_STOCKAGE.IDENTIFIANT_CAISSE);
    if (!id) {
      id = genererIdentifiantAleatoire();
      localStorage.setItem(CLES_STOCKAGE.IDENTIFIANT_CAISSE, id);
    }
    return id;
  }
};
