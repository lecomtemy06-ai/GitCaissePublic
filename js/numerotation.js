/**
 * numerotation.js — Attribution du numéro de chaque ticket.
 *
 * Fonctionnement normal : les appareils réservent ensemble, auprès du
 * dépôt privé GitHub, des BLOCS de numéros (ex. 1-100, puis 101-200...)
 * de façon atomique — jamais deux appareils avec le même bloc (voir
 * github-sync.js : reserverBlocTickets). Chaque appareil consomme
 * ensuite localement les numéros de son bloc, sans appel réseau à
 * chaque vente : la numérotation reste donc quasi continue pour toute
 * l'entreprise, sans jamais faire attendre une vente.
 *
 * Un nouveau bloc est réservé en tâche de fond dès que le bloc courant
 * est entamé à 80% (voir SEUIL_RESERVE_ANTICIPEE), pour qu'il soit déjà
 * prêt bien avant l'épuisement effectif.
 *
 * Filet de sécurité : si un appareil épuise malgré tout son bloc alors
 * qu'il est hors-ligne (cas volontairement rare, blocs larges + réserve
 * anticipée), il continue de vendre avec une numérotation de secours
 * propre à cet appareil (`<identifiant>-SECOURS-000001`...), qui ne
 * peut par construction jamais entrer en collision avec la séquence
 * partagée (format textuellement distinct). Dès la reconnexion d'un
 * appareil dans cette situation, un nouveau bloc est réservé et la
 * séquence partagée reprend pour les ventes suivantes.
 */
import { Stockage } from './stockage.js';
import { reserverBlocTickets } from './github-sync.js';

const SEUIL_RESERVE_ANTICIPEE = 0.2; // part restante du bloc en dessous de laquelle on réserve la suite
const DELAI_MAX_RESERVATION_MS = 3000; // n'attend jamais plus de 3s une réservation avant de se rabattre

let reservationEnCours = null;

function avecDelaiMax(promesse, ms) {
  return Promise.race([
    promesse,
    new Promise((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}

// Empêche deux réservations simultanées sur ce même appareil (ex. deux
// ventes coup sur coup) : la seconde attend le résultat de la première
// au lieu de réserver un bloc en double.
function reserverUneFois() {
  if (!reservationEnCours) {
    reservationEnCours = reserverBlocTickets().finally(() => { reservationEnCours = null; });
  }
  return reservationEnCours;
}

// Réserve le prochain bloc en tâche de fond, sans jamais faire
// attendre l'appelant : le résultat est simplement mis de côté pour
// quand le bloc courant sera épuisé.
function anticiperProchainBloc() {
  reserverUneFois().then(nouveau => {
    if (nouveau) Stockage.sauvegarderBlocEnAttente(nouveau);
  }).catch(() => { /* on retentera au prochain déclenchement */ });
}

function blocAAssezDeMarge(bloc) {
  const taille = bloc.fin - bloc.debut + 1;
  const restant = bloc.fin - bloc.prochain + 1;
  return restant / taille > SEUIL_RESERVE_ANTICIPEE;
}

function obtenirNumeroSecours() {
  const identifiant = Stockage.obtenirOuGenererIdentifiantCaisse();
  const compteur = Stockage.chargerCompteurSecours();
  Stockage.sauvegarderCompteurSecours(compteur + 1);
  return `${identifiant}-SECOURS-${String(compteur).padStart(6, '0')}`;
}

export async function obtenirProchainNumero() {
  let bloc = Stockage.chargerBlocTickets();

  if (!bloc || bloc.prochain > bloc.fin) {
    // Bloc absent ou épuisé : le bloc pré-réservé en anticipation
    // prend le relais s'il est déjà disponible (cas normal).
    const enAttente = Stockage.chargerBlocEnAttente();
    if (enAttente) {
      bloc = { ...enAttente, prochain: enAttente.debut };
      Stockage.effacerBlocEnAttente();
    } else {
      // Sinon, tente une réservation rapide (borne à quelques
      // secondes pour ne jamais bloquer la vente en cours).
      const nouveau = await avecDelaiMax(reserverUneFois(), DELAI_MAX_RESERVATION_MS);
      bloc = nouveau ? { ...nouveau, prochain: nouveau.debut } : null;
    }
  }

  if (!bloc) {
    // Ni bloc actif, ni bloc en attente, ni réservation possible dans
    // le délai imparti (hors-ligne, ou synchronisation pas configurée) :
    // filet de sécurité, jamais de vente bloquée.
    return obtenirNumeroSecours();
  }

  const numero = bloc.prochain;
  bloc.prochain++;
  Stockage.sauvegarderBlocTickets(bloc);

  if (!blocAAssezDeMarge(bloc) && !Stockage.chargerBlocEnAttente()) {
    anticiperProchainBloc();
  }

  return String(numero).padStart(6, '0');
}
