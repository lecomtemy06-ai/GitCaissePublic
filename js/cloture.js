/**
 * cloture.js — Calcul, mise en forme et sauvegarde de la clôture
 * journalière (résumé des ventes, ventilation TVA, totaux par mode
 * de paiement).
 *
 * La clôture est calculée à partir des ventes FUSIONNÉES (locales +
 * dépôt privé), pour qu'elle reflète l'activité de tous les appareils
 * ayant vendu ce jour-là, pas seulement celui qui clôture.
 */
import { SOCIETE, LARGEUR_TICKET } from './config.js';
import { Stockage } from './stockage.js';
import { ventesDuJourFusionnees, dateComptable } from './ventes.js';
import { fileAttendreSynchro } from './github-sync.js';

function centrer(txt, largeur) {
  txt = String(txt);
  if (txt.length >= largeur) return txt.slice(0, largeur);
  return ' '.repeat(Math.floor((largeur - txt.length) / 2)) + txt;
}

// Fonction pure : calcule le résumé d'une clôture à partir d'un
// ensemble de ventes déjà déterminé par l'appelant (voir
// cloturerEtSauvegarder, qui utilise les ventes fusionnées).
export function calculerCloture(ventes, date) {
  if (!ventes.length) return null;

  let totalLiquide = 0, totalBancontact = 0;
  const ventilationGlobale = {};
  const resumeTickets = [];

  ventes.forEach(v => {
    if (v.modePaiement === 'LIQUIDE') totalLiquide += v.totalTTC;
    else if (v.modePaiement === 'BANCONTACT') totalBancontact += v.totalTTC;

    Object.entries(v.ventilation).forEach(([taux, val]) => {
      if (!ventilationGlobale[taux]) ventilationGlobale[taux] = { ht: 0, tva: 0, ttc: 0 };
      ventilationGlobale[taux].ht += val.ht;
      ventilationGlobale[taux].tva += val.tva;
      ventilationGlobale[taux].ttc += val.ttc;
    });

    resumeTickets.push(`N° ${v.numero}  ${v.heureAffichee}  ->  ${v.totalTTC.toFixed(2)} € (${v.modePaiement})`);
  });

  totalLiquide = Math.round(totalLiquide * 100) / 100;
  totalBancontact = Math.round(totalBancontact * 100) / 100;
  Object.keys(ventilationGlobale).forEach(t => {
    ventilationGlobale[t].ht = Math.round(ventilationGlobale[t].ht * 100) / 100;
    ventilationGlobale[t].tva = Math.round(ventilationGlobale[t].tva * 100) / 100;
    ventilationGlobale[t].ttc = Math.round(ventilationGlobale[t].ttc * 100) / 100;
  });

  const totalJour = Math.round(ventes.reduce((s, v) => s + v.totalTTC, 0) * 100) / 100;
  const nbTickets = ventes.length;
  const ticketMoyen = nbTickets ? totalJour / nbTickets : 0;
  const totalTVAJour = Math.round(Object.values(ventilationGlobale).reduce((s, v) => s + v.tva, 0) * 100) / 100;

  return { date, resumeTickets, ventilationGlobale, totalLiquide, totalBancontact, totalJour, nbTickets, ticketMoyen, totalTVAJour };
}

export function formaterClotureTexte(c) {
  const sep = '='.repeat(LARGEUR_TICKET);
  const sep2 = '-'.repeat(LARGEUR_TICKET);
  let txt = sep + '\n';
  txt += centrer('CLÔTURE JOURNALIÈRE', LARGEUR_TICKET) + '\n';
  txt += centrer(SOCIETE.nom, LARGEUR_TICKET) + '\n';
  txt += centrer('N° TVA : ' + SOCIETE.tva, LARGEUR_TICKET) + '\n';
  txt += centrer('Journée du ' + c.date, LARGEUR_TICKET) + '\n';
  txt += sep + '\n';
  txt += c.resumeTickets.join('\n') + '\n';
  txt += sep2 + '\n';
  txt += 'VENTILATION TVA\n';
  Object.keys(c.ventilationGlobale).sort((a, b) => a - b).forEach(taux => {
    const v = c.ventilationGlobale[taux];
    txt += `Base HT ${taux}%`.padEnd(22) + v.ht.toFixed(2).padStart(9) + ' €\n';
    txt += `TVA ${taux}%`.padEnd(22) + v.tva.toFixed(2).padStart(9) + ' €\n';
  });
  txt += sep2 + '\n';
  txt += 'TOTAL LIQUIDE'.padEnd(22) + c.totalLiquide.toFixed(2).padStart(9) + ' €\n';
  txt += 'TOTAL BANCONTACT'.padEnd(22) + c.totalBancontact.toFixed(2).padStart(9) + ' €\n';
  txt += sep2 + '\n';
  txt += 'NOMBRE DE TICKETS'.padEnd(22) + String(c.nbTickets).padStart(9) + '\n';
  txt += 'TICKET MOYEN'.padEnd(22) + c.ticketMoyen.toFixed(2).padStart(9) + ' €\n';
  txt += 'TOTAL TVA'.padEnd(22) + c.totalTVAJour.toFixed(2).padStart(9) + ' €\n';
  txt += sep + '\n';
  txt += 'TOTAL JOURNÉE TTC'.padEnd(22) + c.totalJour.toFixed(2).padStart(9) + ' €\n';
  txt += sep;
  return txt;
}

export async function cloturerEtSauvegarder(date = dateComptable()) {
  const ventes = await ventesDuJourFusionnees(date);
  const c = calculerCloture(ventes, date);
  if (!c) return null;
  const texte = formaterClotureTexte(c);

  const clotures = Stockage.chargerClotures();
  clotures[date] = { ...c, dateHeureCloture: new Date().toISOString(), texte };
  Stockage.sauvegarderClotures(clotures);

  fileAttendreSynchro({ type: 'cloture', date, cloture: clotures[date] });

  return clotures[date];
}

export function getCloture(date) {
  return Stockage.chargerClotures()[date] || null;
}

export function listerClotures() {
  return Stockage.chargerClotures();
}

// Met en cache localement une clôture obtenue depuis le dépôt privé
// (ex. consultée sur un appareil qui ne l'avait pas produite lui-même),
// pour une consultation hors-ligne future.
export function mettreEnCacheCloture(date, cloture) {
  const clotures = Stockage.chargerClotures();
  clotures[date] = cloture;
  Stockage.sauvegarderClotures(clotures);
}

export function supprimerCloture(date) {
  const clotures = Stockage.chargerClotures();
  delete clotures[date];
  Stockage.sauvegarderClotures(clotures);
}
