/**
 * consommation.js — Mode de consommation du ticket en cours :
 * "À emporter" ou "Sur place". Logique pure, sans DOM.
 *
 * Les taux de TVA saisis dans le catalogue sont les taux "à emporter".
 * Sur place, un produit à 6 % est facturé à 12 % ; les produits à 12 %
 * et à 21 % ne changent pas. Les prix TTC ne changent jamais : seule la
 * ventilation HT / TVA du ticket est modifiée.
 *
 * Le mode n'est PAS mémorisé d'un ticket à l'autre : il repasse à "non
 * choisi" après chaque vente ou annulation, pour obliger à un choix
 * conscient à chaque ticket (oublier "Sur place" sous-déclarerait la TVA).
 */

export const MODES = { EMPORTER: 'EMPORTER', SUR_PLACE: 'SUR_PLACE' };

let mode = null; // null = pas encore choisi pour ce ticket
const ecouteurs = [];

export function getMode() {
  return mode;
}

export function definirMode(nouveau) {
  mode = nouveau;
  ecouteurs.forEach(fn => fn(mode));
}

export function reinitialiserMode() {
  definirMode(null);
}

export function onModeChange(fn) {
  ecouteurs.push(fn);
}

// Taux de TVA réellement appliqué à une ligne, selon le mode du ticket.
export function tvaEffective(tvaBase, modeTicket) {
  return (modeTicket === MODES.SUR_PLACE && tvaBase === 6) ? 12 : tvaBase;
}

export function libelleMode(modeTicket) {
  if (modeTicket === MODES.SUR_PLACE) return 'SUR PLACE';
  if (modeTicket === MODES.EMPORTER) return 'À EMPORTER';
  return 'NON PRÉCISÉ';
}
