/**
 * ui-export.js — Écran "Export & Sauvegarde" : boutons de téléchargement
 * (CSV, JSON), restauration de sauvegarde, et réglage du dossier local
 * d'écriture automatique (bonus Chrome/Edge PC & Android — indépendant
 * de la synchronisation GitHub, gérée dans ui-parametres.js).
 */
import { modal, fermerModal, escapeHtml, enregistrerAction } from './ui-modal.js';
import {
  exporterVentesCSV, exporterSauvegardeJSON, restaurerSauvegarde, telechargerFichier,
  supporteDossierLocal, getDossierActif, choisirDossierExport,
  initDossierExport, reactiverDossier
} from './export.js';
import { toutesLesVentes } from './ventes.js';
import { formaterTicketTexte } from './ticket.js';

let importEnAttente = null;

export function initUiExport() {
  document.getElementById('btn-export').addEventListener('click', ouvrirExport);
  document.getElementById('import-json').addEventListener('change', gererImport);

  enregistrerAction('exportCsvJour', () => { if (!exporterVentesCSV(false)) alert('Aucune vente à exporter.'); });
  enregistrerAction('exportCsvTout', () => { if (!exporterVentesCSV(true)) alert('Aucune vente à exporter.'); });
  enregistrerAction('exportJson', exporterSauvegardeJSON);
  enregistrerAction('choisirDossier', gererChoixDossier);
  enregistrerAction('confirmerImport', confirmerImport);
  enregistrerAction('exporterTicket', exporterTicketParNumero);

  initDossierExport(afficherBanniereReconnexion);
}

export function ouvrirExport() {
  const support = supporteDossierLocal();
  const dossier = getDossierActif();
  const info = dossier
    ? `📁 Dossier actif : <strong>${escapeHtml(dossier.name)}</strong> — chaque ticket et clôture y est écrit automatiquement.`
    : (support
        ? "Aucun dossier sélectionné. Utilisez les boutons de téléchargement ci-dessous, ou choisissez un dossier."
        : "Écriture automatique dans un dossier non disponible sur ce navigateur/appareil. Utilisez les boutons de téléchargement ci-dessous.");

  modal(`<h2>Export &amp; Sauvegarde</h2>
    <p class="confirm-txt" style="font-size:12.5px">${info}</p>
    ${support ? `<button class="btn-modal bleu full" style="margin-bottom:10px" data-action="choisirDossier">📁 Choisir un dossier d'export</button>` : ''}
    <div style="display:grid;gap:8px">
      <button class="btn-modal vert" data-action="exportCsvJour">💾 Export CSV — Ventes du jour</button>
      <button class="btn-modal vert" data-action="exportCsvTout">💾 Export CSV — Toutes les ventes</button>
      <button class="btn-modal gris" data-action="exportJson">🗄 Sauvegarde complète (JSON)</button>
      <label class="btn-modal orange" style="text-align:center;display:block;cursor:pointer" for="import-json">📥 Restaurer une sauvegarde JSON</label>
    </div>
    <button class="btn-modal rouge full" style="margin-top:12px" data-action="fermerModal">Fermer</button>`);
}

async function gererChoixDossier() {
  try {
    await choisirDossierExport();
    ouvrirExport();
  } catch (e) { /* sélection annulée par l'utilisateur */ }
}

function gererImport(event) {
  const fichier = event.target.files[0];
  if (!fichier) return;
  const lecteur = new FileReader();
  lecteur.onload = () => {
    try {
      importEnAttente = JSON.parse(lecteur.result);
      const date = importEnAttente.exportLe ? new Date(importEnAttente.exportLe).toLocaleString('fr-BE') : '?';
      modal(`<h2>Restaurer une sauvegarde ?</h2>
        <p class="confirm-txt">Cela va REMPLACER le catalogue, les ventes et les clôtures actuels par ceux du fichier importé (du ${escapeHtml(date)}).</p>
        <div class="modal-actions">
          <button class="btn-modal rouge" data-action="fermerModal">NON</button>
          <button class="btn-modal vert" data-action="confirmerImport">OUI, RESTAURER</button>
        </div>`);
    } catch {
      alert('Fichier invalide.');
    }
  };
  lecteur.readAsText(fichier);
  event.target.value = '';
}

function confirmerImport() {
  if (!importEnAttente) return;
  restaurerSauvegarde(importEnAttente);
  importEnAttente = null;
  fermerModal();
  location.reload();
}

function exporterTicketParNumero(numero) {
  const t = toutesLesVentes().find(v => v.numero === numero);
  if (!t) return;
  telechargerFichier(`ticket_${t.numero}_${t.dateComptable}.txt`, formaterTicketTexte(t), 'text/plain');
}

function afficherBanniereReconnexion(handle) {
  if (document.getElementById('banniere-dossier')) return;
  const b = document.createElement('div');
  b.id = 'banniere-dossier';
  b.textContent = `📁 Toucher ici pour réactiver l'export automatique vers "${handle.name}"`;
  b.addEventListener('click', async () => {
    const ok = await reactiverDossier(handle);
    if (ok) b.remove();
  });
  document.body.appendChild(b);
}
