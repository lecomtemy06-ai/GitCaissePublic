/**
 * ventes.js — Sauvegarde des ventes (tickets) et lecture de l'historique.
 * Écrit toujours en local d'abord (la caisse fonctionne hors-ligne),
 * puis met la vente en file de synchronisation vers GitHub.
 *
 * ventesDuJourFusionnees() est le point d'entrée à utiliser pour toute
 * consultation (Historique, Clôture) : elle combine les ventes connues
 * localement avec celles enregistrées par les AUTRES appareils sur le
 * dépôt privé, pour que chaque machine voie l'activité de toute la
 * caisse, pas seulement la sienne.
 */
import { Stockage } from './stockage.js';
import { creerTicket } from './ticket.js';
import { fileAttendreSynchro, obtenirVentesDistantes } from './github-sync.js';
import { obtenirProchainNumero } from './numerotation.js';

// Une journée commerciale se termine à 6h du matin : une vente faite
// à 1h du matin est comptabilisée sur la journée de la veille.
export function dateComptable() {
  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  return now.toISOString().split('T')[0];
}

export async function enregistrerVente(panier, modePaiement) {
  if (!panier.length) return null;
  const date = dateComptable();
  const numero = await obtenirProchainNumero();
  const appareil = Stockage.obtenirOuGenererIdentifiantCaisse();
  const ticket = creerTicket(numero, panier, modePaiement, date, appareil);

  const ventes = Stockage.chargerVentes();
  ventes.push(ticket);
  Stockage.sauvegarderVentes(ventes);

  fileAttendreSynchro({ type: 'vente', date, ticket });

  return ticket;
}

// Ventes connues localement sur CET appareil uniquement (rapide,
// fonctionne hors-ligne, mais peut être incomplet si d'autres
// appareils ont vendu aujourd'hui).
export function ventesDuJour(date = dateComptable()) {
  return Stockage.chargerVentes().filter(v => v.dateComptable === date);
}

export function toutesLesVentes() {
  return Stockage.chargerVentes();
}

export function datesConnuesLocalement() {
  return [...new Set(Stockage.chargerVentes().map(v => v.dateComptable))];
}

// Fusionne les ventes locales avec celles du dépôt privé pour une date
// donnée (dédoublonnage par numéro de ticket), et met en cache le
// résultat localement pour une consultation hors-ligne future. Revient
// silencieusement aux ventes locales seules si GitHub n'est pas
// configuré ou injoignable.
export async function ventesDuJourFusionnees(date = dateComptable()) {
  const locales = ventesDuJour(date);
  const distantes = await obtenirVentesDistantes(date);
  if (distantes === null) return locales; // non configuré / hors-ligne

  const parNumero = new Map();
  [...locales, ...distantes].forEach(t => parNumero.set(t.numero, t));
  const fusion = [...parNumero.values()].sort((a, b) => a.horodatage.localeCompare(b.horodatage));

  const autresJours = Stockage.chargerVentes().filter(v => v.dateComptable !== date);
  Stockage.sauvegarderVentes([...autresJours, ...fusion]);

  return fusion;
}
