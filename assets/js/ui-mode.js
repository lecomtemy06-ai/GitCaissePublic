/**
 * ui-mode.js — Interface du choix "À emporter" / "Sur place".
 *
 * Deux boutons exclusifs dans la barre du haut. Aucun n'est actif au
 * départ ni après chaque ticket : si l'utilisateur tente de payer sans
 * avoir choisi, une fenêtre lui demande de choisir (voir demanderMode),
 * ce qui garantit un choix conscient à chaque ticket.
 */
import { MODES, getMode, definirMode, onModeChange } from './consommation.js';
import { modal, fermerModal, enregistrerAction } from './ui-modal.js';

export function initUiMode() {
  const btnEmporter = document.getElementById('btn-emporter');
  const btnSurPlace = document.getElementById('btn-surplace');

  btnEmporter.addEventListener('click', () => definirMode(MODES.EMPORTER));
  btnSurPlace.addEventListener('click', () => definirMode(MODES.SUR_PLACE));

  function rafraichir(mode) {
    btnEmporter.classList.toggle('actif', mode === MODES.EMPORTER);
    btnSurPlace.classList.toggle('actif', mode === MODES.SUR_PLACE);
    btnEmporter.setAttribute('aria-pressed', String(mode === MODES.EMPORTER));
    btnSurPlace.setAttribute('aria-pressed', String(mode === MODES.SUR_PLACE));
  }
  onModeChange(rafraichir);
  rafraichir(getMode());

  enregistrerAction('choisirModeEtContinuer', (mode) => {
    definirMode(mode);
    fermerModal();
    if (suiteApresChoix) {
      const suite = suiteApresChoix;
      suiteApresChoix = null;
      suite();
    }
  });
}

let suiteApresChoix = null;

// Demande à l'utilisateur de choisir le mode du ticket, puis exécute
// `suite` une fois le choix fait. À appeler quand le mode est null.
export function demanderMode(suite) {
  suiteApresChoix = suite;
  modal(`<h2>Sur place ou à emporter ?</h2>
    <p class="confirm-txt">Le taux de TVA du ticket dépend de ce choix.</p>
    <div class="modal-actions">
      <button class="btn-modal vert" style="padding:22px 10px;font-size:17px" data-action="choisirModeEtContinuer" data-args='["EMPORTER"]'>À emporter</button>
      <button class="btn-modal bleu" style="padding:22px 10px;font-size:17px" data-action="choisirModeEtContinuer" data-args='["SUR_PLACE"]'>Sur place</button>
      <button class="btn-modal rouge full" data-action="fermerModal">Annuler</button>
    </div>`);
}
