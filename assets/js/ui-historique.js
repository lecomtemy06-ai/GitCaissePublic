/**
 * ui-historique.js — Écrans "Historique des ventes" et "Clôture
 * journalière" (déclenchement, affichage, liste des journées passées).
 *
 * Toute consultation (ventes d'un jour, clôtures) va interroger le
 * dépôt privé en plus des données locales, pour qu'une machine puisse
 * voir l'activité de toutes les autres — y compris après un vidage du
 * cache local, tant que le jeton GitHub de cet appareil est configuré
 * (voir ui-parametres.js).
 */
import { ventesDuJourFusionnees, dateComptable, datesConnuesLocalement } from './ventes.js';
import { formaterTicketTexte } from './ticket.js';
import {
  cloturerEtSauvegarder, listerClotures, getCloture, mettreEnCacheCloture,
  supprimerCloture as supprimerClotureDonnees
} from './cloture.js';
import { getConfigGithub, obtenirClotureDistante, listerFichiersDistants } from './github-sync.js';
import { modal, fermerModal, escapeHtml, enregistrerAction, attrArgs } from './ui-modal.js';
import { telechargerFichier, ecrireFichierDossier } from './export.js';

export function initUiHistorique() {
  document.getElementById('btn-historique').addEventListener('click', () => afficherHistorique());
  document.getElementById('btn-cloture').addEventListener('click', declencherCloture);
  enregistrerAction('exporterCloture', exporterClotureTxt);
  enregistrerAction('voirCloture', voirCloture);
  enregistrerAction('supprimerCloture', demanderSuppressionCloture);
  enregistrerAction('confirmerSuppCloture', confirmerSuppressionCloture);
  enregistrerAction('ouvrirListeClotures', ouvrirListeClotures);
  enregistrerAction('afficherHistorique', (date) => afficherHistorique(date));
  enregistrerAction('ouvrirListeJoursVentes', ouvrirListeJoursVentes);
}

function afficherChargement(titre) {
  modal(`<h2>${escapeHtml(titre)}</h2><p class="confirm-txt">Récupération des données...</p>`);
}

function messageNonConfigure() {
  return `<p class="confirm-txt" style="font-size:12px;color:#FFB74D">
    ⚠️ Jeton GitHub non configuré sur cet appareil : seules les ventes
    faites ICI sont affichées (voir Gestion des prix → ⚙️ Paramètres).
  </p>`;
}

export async function afficherHistorique(date = dateComptable()) {
  afficherChargement('Historique — ' + date);
  const configure = !!getConfigGithub();
  const ventes = await ventesDuJourFusionnees(date);
  const texte = ventes.length
    ? ventes.map(formaterTicketTexte).join('\n\n')
    : "Aucune vente enregistrée pour cette journée.";
  modal(`<h2>Historique du ${date} (${ventes.length} ticket${ventes.length > 1 ? 's' : ''})</h2>
    ${configure ? '' : messageNonConfigure()}
    <div class="cloture-texte">${escapeHtml(texte)}</div>
    <div class="modal-actions">
      <button class="btn-modal gris" data-action="ouvrirListeJoursVentes">📅 Autres journées</button>
      <button class="btn-modal vert" data-action="fermerModal">✅ Fermer</button>
    </div>`);
}

export async function ouvrirListeJoursVentes() {
  afficherChargement('Journées avec des ventes');
  const locales = datesConnuesLocalement();
  const distantes = await listerFichiersDistants('ventes');
  const ensemble = new Set(locales);
  (distantes || []).forEach(d => ensemble.add(d));
  const dates = [...ensemble].sort().reverse();

  let h = `<h2>Journées avec des ventes</h2><div class="gestion-scroll">`;
  if (!dates.length) {
    h += '<p class="confirm-txt">Aucune vente enregistrée.</p>';
  } else {
    dates.forEach(d => {
      h += `<div class="fichier-ligne">
        <button class="fichier-btn" data-action="afficherHistorique" data-args="${attrArgs([d])}">${d}</button>
      </div>`;
    });
  }
  h += `</div><button class="btn-modal rouge full" style="margin-top:10px" data-action="fermerModal">Fermer</button>`;
  modal(h);
}

async function declencherCloture() {
  afficherChargement('Clôture en cours');
  const c = await cloturerEtSauvegarder();
  if (!c) {
    modal(`<h2>Clôture</h2>
      <p class="confirm-txt">Aucune vente pour cette journée.</p>
      <button class="btn-modal rouge full" data-action="fermerModal">FERMER</button>`);
    return;
  }
  ecrireFichierDossier(`cloture_${c.date}.txt`, c.texte);
  modal(`<h2>CLÔTURE JOURNÉE</h2>
    <div style="color:#aaa;text-align:center;margin-bottom:8px">${c.date}</div>
    <div class="cloture-texte">${escapeHtml(c.texte)}</div>
    <div class="modal-actions">
      <button class="btn-modal gris" data-action="exporterCloture" data-args="${attrArgs([c.date])}">💾 Exporter (.txt)</button>
      <button class="btn-modal vert" data-action="fermerModal">✅ Fermer</button>
    </div>`);
}

function exporterClotureTxt(date) {
  const c = getCloture(date);
  if (!c) return;
  telechargerFichier(`cloture_${date}.txt`, c.texte, 'text/plain');
}

export async function ouvrirListeClotures() {
  afficherChargement('Liste des clôtures');
  const local = listerClotures();
  const datesDistantes = await listerFichiersDistants('clotures');
  const ensemble = new Set(Object.keys(local));
  (datesDistantes || []).forEach(d => ensemble.add(d));
  const dates = [...ensemble].sort().reverse();

  let h = `<h2>Liste des clôtures</h2><div class="gestion-scroll">`;
  if (!dates.length) {
    h += '<p class="confirm-txt">Aucune clôture enregistrée.</p>';
  } else {
    dates.forEach(d => {
      const total = local[d] ? `${local[d].totalJour.toFixed(2)} €` : '(à consulter)';
      h += `<div class="fichier-ligne">
        <button class="fichier-btn" data-action="voirCloture" data-args="${attrArgs([d])}">cloture_${d} — ${total}</button>
        <button class="btn-del" data-action="supprimerCloture" data-args="${attrArgs([d])}">🗑</button>
      </div>`;
    });
  }
  h += `</div><button class="btn-modal rouge full" style="margin-top:10px" data-action="fermerModal">Fermer</button>`;
  modal(h);
}

async function voirCloture(date) {
  let c = getCloture(date);
  if (!c) {
    afficherChargement('Clôture ' + date);
    c = await obtenirClotureDistante(date);
    if (c) mettreEnCacheCloture(date, c);
  }
  const texte = c ? c.texte : "Introuvable, ni localement ni sur le dépôt privé.";
  modal(`<h2>Clôture ${date}</h2>
    <div class="cloture-texte">${escapeHtml(texte)}</div>
    <div class="modal-actions">
      <button class="btn-modal gris" data-action="exporterCloture" data-args="${attrArgs([date])}">💾 Exporter</button>
      <button class="btn-modal vert" data-action="ouvrirListeClotures">⬅ Retour</button>
    </div>`);
}

function demanderSuppressionCloture(date) {
  modal(`<h2>Confirmation</h2>
    <p class="confirm-txt">Supprimer la clôture du ${date} de la copie locale de cet appareil ? (ne supprime pas le fichier sur GitHub)</p>
    <div class="modal-actions">
      <button class="btn-modal rouge" data-action="ouvrirListeClotures">NON</button>
      <button class="btn-modal vert" data-action="confirmerSuppCloture" data-args="${attrArgs([date])}">OUI</button>
    </div>`);
}

function confirmerSuppressionCloture(date) {
  supprimerClotureDonnees(date);
  ouvrirListeClotures();
}
