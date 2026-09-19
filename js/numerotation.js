/**
 * numerotation.js — Attribution du numéro de chaque ticket.
 *
 * Fonctionnement normal : à chaque vente, l'appareil réserve auprès du
 * dépôt privé GitHub LE PROCHAIN NUMÉRO LIBRE (et un seul), de façon
 * atomique (voir github-sync.js : reserverNumeroTicket). Ceci garantit
 * une suite ininterrompue et partagée par tous les appareils — c'est la
 * priorité demandée pour la tenue comptable, quitte à ce que chaque
 * vente attende une confirmation réseau (généralement quelques
 * centaines de millisecondes).
 *
 * Filet de sécurité : si la réservation échoue (hors-ligne, ou
 * synchronisation pas configurée), l'appareil ne bloque jamais la
 * vente pour autant : il bascule sur une numérotation de secours qui
 * lui est propre (`<identifiant>-SECOURS-000001`...), textuellement
 * distincte de la séquence partagée (qui ne contient que des chiffres),
 * donc jamais en collision avec elle.
 */
import { Stockage } from './stockage.js';
import { reserverNumeroTicket } from './github-sync.js';

const DELAI_MAX_RESERVATION_MS = 3000; // n'attend jamais plus de 3s avant de se rabattre sur le secours

function avecDelaiMax(promesse, ms) {
  return Promise.race([
    promesse,
    new Promise((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}

function obtenirNumeroSecours() {
  const identifiant = Stockage.obtenirOuGenererIdentifiantCaisse();
  const compteur = Stockage.chargerCompteurSecours();
  Stockage.sauvegarderCompteurSecours(compteur + 1);
  return `${identifiant}-SECOURS-${String(compteur).padStart(6, '0')}`;
}

export async function obtenirProchainNumero() {
  const numero = await avecDelaiMax(reserverNumeroTicket(), DELAI_MAX_RESERVATION_MS);
  if (numero === null) return obtenirNumeroSecours();
  return String(numero).padStart(6, '0');
}
