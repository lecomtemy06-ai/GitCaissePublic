/**
 * clavier.js — Composants réutilisables : pavé numérique et clavier
 * alphabétique AZERTY, utilisés dans les écrans de saisie (mot de passe,
 * prix, renommage d'article...). Chaque fonction construit un élément
 * DOM autonome et appelle surTouche(valeur) à chaque pression.
 */

export function creerPaveNumerique(surTouche) {
  const conteneur = document.createElement('div');
  conteneur.className = 'pave';
  ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', 'C'].forEach(b => {
    const btn = document.createElement('button');
    if (b === 'C') btn.classList.add('rouge');
    btn.textContent = b;
    btn.addEventListener('click', () => surTouche(b));
    conteneur.appendChild(btn);
  });
  return conteneur;
}

export function creerClavierAzerty(surTouche) {
  const conteneur = document.createElement('div');
  conteneur.className = 'clavier';
  const rangees = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];
  rangees.forEach(rangee => {
    const ligne = document.createElement('div');
    ligne.className = 'clavier-row';
    rangee.split('').forEach(l => {
      const btn = document.createElement('button');
      btn.className = 'btn-lettre';
      btn.textContent = l;
      btn.addEventListener('click', () => surTouche(l));
      ligne.appendChild(btn);
    });
    conteneur.appendChild(ligne);
  });

  const derniere = document.createElement('div');
  derniere.className = 'clavier-row';
  const espace = document.createElement('button');
  espace.className = 'btn-lettre special';
  espace.textContent = 'ESPACE';
  espace.addEventListener('click', () => surTouche('SPC'));
  const retour = document.createElement('button');
  retour.className = 'btn-lettre special';
  retour.style.background = 'var(--red)';
  retour.textContent = '⌫';
  retour.addEventListener('click', () => surTouche('BACK'));
  derniere.append(espace, retour);
  conteneur.appendChild(derniere);

  return conteneur;
}
