/**
 * app.js — Point d'entrée de l'application. Démarre les modules dans un
 * ordre cohérent et relie les éléments d'interface qui ne dépendent
 * d'aucun écran modal (calculatrice, horloge, bouton Quitter, PWA).
 */
import { initCatalogue } from './catalogue.js';
import { initUiMenu } from './ui-menu.js';
import { initUiPaiement } from './ui-paiement.js';
import { initUiHistorique } from './ui-historique.js';
import { initUiExport } from './ui-export.js';
import { initUiGestion } from './ui-gestion.js';
import { initUiParametres } from './ui-parametres.js';
import { creerCalculatrice } from './calculatrice.js';
import { traiterFile } from './github-sync.js';
import { modal, enregistrerAction } from './ui-modal.js';

function initCalculatrice() {
  const calc = creerCalculatrice();
  const ecran = document.getElementById('ecran-calc');
  const grille = document.getElementById('grille-calc');
  const boutons = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'];
  boutons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'btn-calc' + (['/', '+', '-', '*'].includes(b) ? ' op' : '');
    btn.textContent = b;
    btn.addEventListener('click', () => {
      if (b === '=') {
        calc.valider();
        ecran.textContent = '';
      } else {
        ecran.textContent = calc.saisir(b);
      }
    });
    grille.appendChild(btn);
  });
}

function initHorloge() {
  const elDate = document.getElementById('h-date');
  const elHeure = document.getElementById('h-heure');
  function maj() {
    const now = new Date();
    elDate.textContent = now.toLocaleDateString('fr-BE');
    elHeure.textContent = now.toLocaleTimeString('fr-BE');
    setTimeout(maj, 1000);
  }
  maj();
}

function initQuitter() {
  document.getElementById('btn-quitter').addEventListener('click', () => {
    modal(`<h2>Quitter ?</h2>
      <div class="modal-actions">
        <button class="btn-modal rouge" data-action="fermerModal">NON</button>
        <button class="btn-modal vert" data-action="confirmerQuitter">OUI</button>
      </div>`);
  });
  enregistrerAction('confirmerQuitter', () => window.close());
}

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(e => console.warn('Service worker non enregistré', e));
  }
}

async function demarrer() {
  await initCatalogue();
  initUiMenu();
  initUiPaiement();
  initUiHistorique();
  initUiExport();
  initUiGestion();
  initUiParametres();
  initCalculatrice();
  initHorloge();
  initQuitter();
  initServiceWorker();
  traiterFile(); // tente une synchronisation immédiate si déjà configuré
}

demarrer();
