/**
 * ui-paiement.js — Écran de paiement (rendu monnaie), validation de la
 * transaction (sauvegarde du ticket) et affichage du reçu.
 */
import { getPanier, getTotal, vider } from './panier.js';
import { enregistrerVente } from './ventes.js';
import { formaterTicketTexte } from './ticket.js';
import { modal, fermerModal, escapeHtml, enregistrerAction, attrArgs } from './ui-modal.js';
import { creerPaveNumerique } from './clavier.js';
import { ecrireFichierDossier } from './export.js';

export function initUiPaiement() {
  document.getElementById('btn-reset').addEventListener('click', demanderReset);
  document.getElementById('btn-paiement').addEventListener('click', ouvrirRendu);
  enregistrerAction('confirmerReset', confirmerReset);
}

function demanderReset() {
  if (!getPanier().length) return;
  modal(`<h2>Annuler la transaction ?</h2>
    <div class="modal-actions">
      <button class="btn-modal rouge" data-action="fermerModal">NON</button>
      <button class="btn-modal vert" data-action="confirmerReset">OUI</button>
    </div>`);
}

function confirmerReset() {
  vider();
  document.getElementById('ecran-calc').textContent = '';
  fermerModal();
}

function ouvrirRendu() {
  const total = getTotal();
  if (total === 0) return;

  let montantSaisi = '';
  let paiementChoisi = null;

  const conteneur = document.createElement('div');
  const titre = document.createElement('h2');
  titre.textContent = 'Rendu Monnaie';

  const ligneTotal = document.createElement('div');
  ligneTotal.style.cssText = 'color:var(--accent);text-align:center;font-size:18px;margin-bottom:8px';
  ligneTotal.innerHTML = `Total à payer : <strong>${total.toFixed(2)} €</strong>`;

  const ecran = document.createElement('div');
  ecran.className = 'modal-ecran';
  ecran.textContent = '0';

  const msg = document.createElement('div');
  msg.className = 'msg-resultat';

  function rafraichirMessage() {
    if (paiementChoisi !== 'LIQUIDE') return;
    if (!montantSaisi) { msg.innerHTML = '<span style="color:#66BB6A">Compte juste</span>'; return; }
    const m = parseFloat(montantSaisi);
    if (isNaN(m)) return;
    const rendu = m - total;
    msg.innerHTML = rendu < 0
      ? '<span style="color:red">Montant insuffisant</span>'
      : `<span style="color:#66BB6A">À rendre : ${rendu.toFixed(2)} €</span>`;
  }

  const pave = creerPaveNumerique((touche) => {
    montantSaisi = touche === 'C' ? '' : montantSaisi + touche;
    ecran.textContent = montantSaisi || '0';
    rafraichirMessage();
  });

  const boutonsPaiement = document.createElement('div');
  boutonsPaiement.className = 'modal-actions';

  const btnBancontact = document.createElement('button');
  btnBancontact.className = 'btn-modal bleu';
  btnBancontact.textContent = 'Bancontact';
  const btnLiquide = document.createElement('button');
  btnLiquide.className = 'btn-modal vert';
  btnLiquide.textContent = 'Liquide';

  btnBancontact.addEventListener('click', () => {
    paiementChoisi = 'BANCONTACT';
    btnBancontact.style.opacity = '1';
    btnLiquide.style.opacity = '0.6';
    msg.innerHTML = '<span style="color:#42A5F5">Paiement par carte</span>';
    erreur.textContent = '';
  });
  btnLiquide.addEventListener('click', () => {
    paiementChoisi = 'LIQUIDE';
    btnLiquide.style.opacity = '1';
    btnBancontact.style.opacity = '0.6';
    erreur.textContent = '';
    rafraichirMessage();
  });

  const btnAnnuler = document.createElement('button');
  btnAnnuler.className = 'btn-modal rouge';
  btnAnnuler.textContent = '❌ Annuler';
  btnAnnuler.addEventListener('click', fermerModal);

  const btnValider = document.createElement('button');
  btnValider.className = 'btn-modal vert';
  btnValider.textContent = '✅ Valider';

  const erreur = document.createElement('div');
  erreur.className = 'error-txt';

  btnValider.addEventListener('click', async () => {
    if (!paiementChoisi) { erreur.textContent = 'Choisir un mode de paiement'; return; }
    btnValider.disabled = true;
    btnValider.textContent = '...';
    const panierActuel = getPanier();
    const ticket = await enregistrerVente(panierActuel, paiementChoisi);
    vider();
    document.getElementById('ecran-calc').textContent = '';
    fermerModal();
    if (ticket) {
      afficherTicketModal(ticket);
      ecrireFichierDossier(
        `ticket_${ticket.numero}_${ticket.dateComptable}.txt`,
        formaterTicketTexte(ticket)
      );
    }
  });

  boutonsPaiement.append(btnBancontact, btnLiquide, btnAnnuler, btnValider);
  conteneur.append(titre, ligneTotal, ecran, msg, pave, boutonsPaiement, erreur);
  modal(conteneur);
}

export function afficherTicketModal(ticket) {
  modal(`<h2>Ticket N° ${escapeHtml(ticket.numero)}</h2>
    <div class="cloture-texte">${escapeHtml(formaterTicketTexte(ticket))}</div>
    <div class="modal-actions">
      <button class="btn-modal gris" data-action="exporterTicket" data-args="${attrArgs([ticket.numero])}">💾 Exporter ce ticket</button>
      <button class="btn-modal vert" data-action="fermerModal">✅ Fermer</button>
    </div>`);
}
