/**
 * ui-modal.js — Moteur générique de fenêtres modales (pop-up).
 *
 * Deux façons de fournir le contenu :
 *  - une chaîne HTML (pour un contenu simple/statique) : les boutons y
 *    utilisent l'attribut data-action="nomAction" (+ data-args="[...]"
 *    en JSON si besoin d'arguments) plutôt que des attributs onclick,
 *    via une délégation d'événements centralisée ci-dessous.
 *  - un noeud DOM déjà construit (pour un contenu interactif nécessitant
 *    des fermetures, ex. un écran de saisie avec pavé numérique).
 *
 * Ce choix évite toute exposition de fonctions sur `window` et tout
 * risque lié à l'échappement des guillemets dans les attributs onclick.
 */

const gestionnairesActions = {};

export function enregistrerAction(nom, fn) {
  gestionnairesActions[nom] = fn;
}

document.addEventListener('click', (e) => {
  const cible = e.target.closest('[data-action]');
  if (!cible) return;
  const nom = cible.dataset.action;
  const fn = gestionnairesActions[nom];
  if (!fn) return;
  const args = cible.dataset.args ? JSON.parse(cible.dataset.args) : [];
  fn(...args, cible);
});

export function modal(contenu) {
  fermerModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  const boite = document.createElement('div');
  boite.className = 'modal';
  if (typeof contenu === 'string') {
    boite.innerHTML = contenu;
  } else {
    boite.appendChild(contenu);
  }
  overlay.appendChild(boite);
  document.body.appendChild(overlay);
}

export function fermerModal() {
  const o = document.getElementById('modal-overlay');
  if (o) o.remove();
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Sérialise des arguments pour un attribut data-args, en échappant les
// guillemets afin de rester valide dans un attribut HTML même si les
// valeurs contiennent des apostrophes ou des caractères spéciaux.
export function attrArgs(args) {
  return escapeHtml(JSON.stringify(args));
}

// Action générique disponible partout
enregistrerAction('fermerModal', fermerModal);
