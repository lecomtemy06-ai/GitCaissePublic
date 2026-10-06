/**
 * plein-ecran.js — Bouton de bascule plein écran.
 *
 * Un seul bouton dans la barre du haut : "⛶" pour passer en plein écran,
 * qui devient la croix rouge "✕" une fois en plein écran, pour en sortir.
 *
 * Limites imposées par les navigateurs :
 *  - le plein écran ne peut être demandé que suite à un clic (impossible
 *    de le lancer automatiquement au démarrage) ;
 *  - Safari sur iPhone ne le permet pas pour une page web (l'iPad oui) :
 *    dans ce cas le bouton est masqué. L'application installée sur
 *    l'écran d'accueil (PWA) s'ouvre de toute façon sans barre d'adresse.
 */

function elementPleinEcran() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function peutPleinEcran() {
  const racine = document.documentElement;
  return !!(racine.requestFullscreen || racine.webkitRequestFullscreen);
}

function entrer() {
  const racine = document.documentElement;
  const demande = racine.requestFullscreen || racine.webkitRequestFullscreen;
  const promesse = demande.call(racine);
  if (promesse && promesse.catch) promesse.catch(e => console.warn('Plein écran refusé', e));
}

function sortir() {
  const fin = document.exitFullscreen || document.webkitExitFullscreen;
  if (!fin) return;
  const promesse = fin.call(document);
  if (promesse && promesse.catch) promesse.catch(() => {});
}

export function initPleinEcran() {
  const bouton = document.getElementById('btn-plein-ecran');
  if (!peutPleinEcran()) {
    bouton.style.display = 'none';
    return;
  }

  function rafraichir() {
    const actif = !!elementPleinEcran();
    bouton.textContent = actif ? '✕' : '⛶';
    bouton.title = actif ? 'Quitter le plein écran' : 'Passer en plein écran';
    bouton.setAttribute('aria-label', bouton.title);
    bouton.classList.toggle('rouge', actif);
  }

  bouton.addEventListener('click', () => {
    if (elementPleinEcran()) sortir();
    else entrer();
  });
  document.addEventListener('fullscreenchange', rafraichir);
  document.addEventListener('webkitfullscreenchange', rafraichir);
  rafraichir();
}
