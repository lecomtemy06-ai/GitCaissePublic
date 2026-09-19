/**
 * ui-ristourne.js — Pop-up de saisie d'une ristourne (remise ponctuelle).
 * Ajoute au panier une ligne négative du montant saisi, au taux de TVA
 * choisi par l'utilisateur. Empêche de faire passer le total du panier
 * sous 0 € (on peut offrir un article, pas rendre de l'argent).
 */
import { getTotal, ajouterArticle } from './panier.js';
import { modal, fermerModal } from './ui-modal.js';
import { creerPaveNumerique } from './clavier.js';

export function ouvrirRistournePopup() {
  let saisie = '';
  let tvaChoisie = 6;

  const conteneur = document.createElement('div');
  const titre = document.createElement('h2');
  titre.textContent = 'Ristourne';

  const ecran = document.createElement('div');
  ecran.className = 'modal-ecran';
  ecran.textContent = '0';

  const erreur = document.createElement('div');
  erreur.className = 'error-txt';

  const pave = creerPaveNumerique((touche) => {
    saisie = touche === 'C' ? '' : saisie + touche;
    ecran.textContent = saisie || '0';
    erreur.textContent = '';
  });

  const labelTva = document.createElement('div');
  labelTva.style.cssText = 'color:#aaa;font-size:13px;margin:4px 0 6px';
  labelTva.textContent = 'Taux de TVA applicable à cette ristourne';

  const zoneTva = document.createElement('div');
  zoneTva.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px';
  const boutonsTva = {};
  [6, 12, 21].forEach(taux => {
    const btn = document.createElement('button');
    btn.className = 'btn-modal' + (taux === tvaChoisie ? ' bleu' : ' gris');
    btn.textContent = taux + '%';
    btn.addEventListener('click', () => {
      tvaChoisie = taux;
      Object.entries(boutonsTva).forEach(([t, b]) => {
        b.className = 'btn-modal' + (parseInt(t, 10) === tvaChoisie ? ' bleu' : ' gris');
      });
    });
    boutonsTva[taux] = btn;
    zoneTva.appendChild(btn);
  });

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const btnAnnuler = document.createElement('button');
  btnAnnuler.className = 'btn-modal rouge';
  btnAnnuler.textContent = '❌ Annuler';
  btnAnnuler.addEventListener('click', fermerModal);

  const btnValider = document.createElement('button');
  btnValider.className = 'btn-modal vert';
  btnValider.textContent = '✅ Valider';
  btnValider.addEventListener('click', () => {
    const montant = parseFloat(saisie);
    if (!saisie || isNaN(montant) || montant <= 0) {
      erreur.textContent = 'Entre un montant valide.';
      return;
    }
    if (getTotal() - montant < -0.001) {
      erreur.textContent = "Cette ristourne ferait passer le panier sous 0 € (tu peux offrir un panier, pas de l'argent).";
      return;
    }
    ajouterArticle('Ristourne', -montant, tvaChoisie);
    fermerModal();
  });

  actions.append(btnAnnuler, btnValider);
  conteneur.append(titre, ecran, labelTva, zoneTva, pave, erreur, actions);
  modal(conteneur);
}
