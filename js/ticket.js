/**
 * ticket.js — Calculs et mise en forme du ticket de caisse légal (Belgique).
 * Fonctions pures : aucune dépendance au DOM ni au stockage, ce qui les
 * rend faciles à relire et à vérifier isolément.
 */
import { SOCIETE, LARGEUR_TICKET } from './config.js';

// Ventile un ensemble de lignes (panier) par taux de TVA : pour chaque
// taux présent, calcule la base HT et le montant de TVA correspondants.
export function calculerVentilationTVA(lignes) {
  const parTaux = {};
  lignes.forEach(l => {
    const montantTTC = Math.round(l.prixUnitaire * l.quantite * 100) / 100;
    if (!parTaux[l.tva]) parTaux[l.tva] = { ttc: 0 };
    parTaux[l.tva].ttc = Math.round((parTaux[l.tva].ttc + montantTTC) * 100) / 100;
  });
  Object.keys(parTaux).forEach(t => {
    const taux = parseFloat(t);
    const ttc = parTaux[t].ttc;
    const ht = Math.round((ttc / (1 + taux / 100)) * 100) / 100;
    const tva = Math.round((ttc - ht) * 100) / 100;
    parTaux[t] = { ttc, ht, tva };
  });
  return parTaux;
}

function centrer(txt, largeur) {
  txt = String(txt);
  if (txt.length >= largeur) return txt.slice(0, largeur);
  const espace = largeur - txt.length;
  return ' '.repeat(Math.floor(espace / 2)) + txt;
}

function ligneColonnes(qte, nom, pu, tva, total) {
  const q = String(qte).padStart(3);
  let d = String(nom);
  if (d.length > 17) d = d.slice(0, 16) + '…';
  d = d.padEnd(18);
  const p = String(pu).padStart(6);
  const t = String(tva).padStart(5);
  const tot = String(total).padStart(8);
  return `${q} ${d}${p} ${t} ${tot}`;
}

// Construit l'objet ticket structuré à partir du panier de la vente en cours.
// `appareil` est une métadonnée de traçabilité (quel appareil a fait la
// vente) : elle n'apparaît pas sur le ticket imprimé, mais est conservée
// dans les données (export CSV notamment), la numérotation elle-même
// étant désormais une séquence partagée entre tous les appareils.
export function creerTicket(numero, panier, modePaiement, dateComptable, appareil) {
  const maintenant = new Date();
  const lignes = panier.map(l => ({ ...l }));
  const ventilation = calculerVentilationTVA(lignes);
  const totalTTC = Math.round(lignes.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0) * 100) / 100;
  return {
    numero,
    appareil,
    dateComptable,
    horodatage: maintenant.toISOString(),
    dateAffichee: maintenant.toLocaleDateString('fr-BE'),
    heureAffichee: maintenant.toLocaleTimeString('fr-BE'),
    lignes,
    ventilation,
    modePaiement,
    totalTTC
  };
}

// Met en forme un ticket au format texte légal :
// identité de la société, n° TVA, date/heure, n° de ticket, détail des
// lignes, base HT et TVA ventilées par taux, total TVA, total TTC.
export function formaterTicketTexte(t) {
  const sep = '='.repeat(LARGEUR_TICKET);
  const sep2 = '-'.repeat(LARGEUR_TICKET);
  const L = [];
  L.push(sep);
  L.push(centrer('TICKET DE CAISSE TVA', LARGEUR_TICKET));
  L.push(centrer(SOCIETE.nom, LARGEUR_TICKET));
  L.push(centrer(SOCIETE.adresse1, LARGEUR_TICKET));
  L.push(centrer(SOCIETE.adresse2, LARGEUR_TICKET));
  L.push(centrer('N° TVA : ' + SOCIETE.tva, LARGEUR_TICKET));
  L.push(sep);
  L.push(`Ticket N° ${t.numero}`);
  L.push(`Date : ${t.dateAffichee}    Heure : ${t.heureAffichee}`);
  L.push(sep2);
  L.push(ligneColonnes('Qté', 'Article', 'P.U.', 'TVA', 'Total'));
  L.push(sep2);
  t.lignes.forEach(l => {
    const tot = (l.prixUnitaire * l.quantite).toFixed(2);
    L.push(ligneColonnes(l.quantite, l.nom, l.prixUnitaire.toFixed(2), l.tva + '%', tot));
  });
  L.push(sep2);
  Object.keys(t.ventilation).sort((a, b) => a - b).forEach(taux => {
    const v = t.ventilation[taux];
    L.push(`Base HT ${taux}%`.padEnd(22) + v.ht.toFixed(2).padStart(9) + ' €');
    L.push(`TVA ${taux}%`.padEnd(22) + v.tva.toFixed(2).padStart(9) + ' €');
  });
  L.push(sep2);
  const totalTVA = Math.round(Object.values(t.ventilation).reduce((s, v) => s + v.tva, 0) * 100) / 100;
  L.push('TOTAL TVA'.padEnd(22) + totalTVA.toFixed(2).padStart(9) + ' €');
  L.push('TOTAL TTC A PAYER'.padEnd(22) + t.totalTTC.toFixed(2).padStart(9) + ' €');
  L.push(`Mode de paiement : ${t.modePaiement}`);
  L.push(sep);
  L.push(centrer('Merci de votre visite !', LARGEUR_TICKET));
  L.push(centrer('TVA incluse conformément à la législation', LARGEUR_TICKET));
  L.push(sep);
  return L.join('\n');
}
