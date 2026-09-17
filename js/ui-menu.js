/**
 * ui-menu.js — Navigation du menu de vente (catégories → articles →
 * viandes → options) et affichage du panier. Utilise l'API DOM
 * directement : cette partie ne nécessite pas de moteur de gabarits.
 */
import { getCatalogue } from './catalogue.js';
import { ajouterArticle, supprimerArticle, getPanier, getTotal, onChangement } from './panier.js';
import { enregistrerAction, escapeHtml } from './ui-modal.js';

const elMenu = () => document.getElementById('zone-menu');
const elFooter = () => document.getElementById('zone-footer');

export function initUiMenu() {
  enregistrerAction('supprimerLigne', (index) => supprimerArticle(index));
  onChangement(rafraichirPanier);
  afficherCategories();
  rafraichirPanier({ total: getTotal(), panier: getPanier() });
}

export function afficherCategories() {
  const menu = elMenu();
  const footer = elFooter();
  menu.innerHTML = '';
  footer.innerHTML = '';
  menu.style.gridTemplateColumns = 'repeat(3, 1fr)';
  const catalogue = getCatalogue();

  Object.keys(catalogue.categories).forEach(nom => {
    const btn = document.createElement('button');
    btn.className = 'btn-menu';
    btn.textContent = nom;
    btn.addEventListener('click', () => afficherArticles(nom));
    menu.appendChild(btn);
  });
}

function afficherArticles(categorie) {
  const menu = elMenu();
  const footer = elFooter();
  menu.innerHTML = '';
  footer.innerHTML = '';
  menu.style.gridTemplateColumns = 'repeat(3, 1fr)';
  const catalogue = getCatalogue();

  if (categorie === 'Plats') {
    Object.keys(catalogue.categories.Plats.types).forEach(nom => {
      const btn = document.createElement('button');
      btn.className = 'btn-menu';
      btn.textContent = nom;
      btn.addEventListener('click', () => afficherViandes(nom));
      menu.appendChild(btn);
    });
  } else {
    Object.entries(catalogue.categories[categorie]).forEach(([nom, obj]) => {
      const btn = document.createElement('button');
      btn.className = 'btn-menu';
      btn.innerHTML = `${escapeHtml(nom)}<br><span style="color:var(--accent);font-size:0.85em">${obj.prix.toFixed(2)} €</span>`;
      btn.addEventListener('click', () => ajouterArticle(nom, obj.prix, obj.tva));
      menu.appendChild(btn);
    });
  }

  ajouterBoutonRetour(footer, afficherCategories);
}

function afficherViandes(typePlat) {
  const menu = elMenu();
  const footer = elFooter();
  menu.innerHTML = '';
  footer.innerHTML = '';
  menu.style.gridTemplateColumns = 'repeat(3, 1fr)';
  const catalogue = getCatalogue();
  const prixType = catalogue.categories.Plats.types[typePlat].prix;

  Object.entries(catalogue.categories.Plats.viandes).forEach(([nom, obj]) => {
    const btn = document.createElement('button');
    btn.className = 'btn-menu';
    btn.innerHTML = `${escapeHtml(nom)}<br><span style="color:var(--accent);font-size:0.85em">${(prixType + obj.prix).toFixed(2)} €</span>`;
    btn.addEventListener('click', () => afficherOptions(typePlat, nom));
    menu.appendChild(btn);
  });

  ajouterBoutonRetour(footer, () => afficherArticles('Plats'));
}

function afficherOptions(typePlat, viande) {
  const menu = elMenu();
  const footer = elFooter();
  menu.innerHTML = '';
  footer.innerHTML = '';
  menu.style.gridTemplateColumns = 'repeat(2, 1fr)';
  const catalogue = getCatalogue();
  const prixType = catalogue.categories.Plats.types[typePlat].prix;
  const objViande = catalogue.categories.Plats.viandes[viande];
  const selection = {};
  let totalVar = prixType + objViande.prix;

  const label = document.createElement('div');
  label.style.cssText = 'grid-column:1/-1;color:var(--accent);font-size:18px;font-weight:bold;text-align:center;padding:6px;';
  label.textContent = 'TOTAL : ' + totalVar.toFixed(2) + ' €';
  menu.appendChild(label);

  function recalc() {
    let extra = 0;
    Object.entries(selection).forEach(([n, v]) => { if (v) extra += catalogue.supplements[n].prix; });
    totalVar = prixType + objViande.prix + extra;
    label.textContent = 'TOTAL : ' + totalVar.toFixed(2) + ' €';
  }

  Object.entries(catalogue.supplements).forEach(([nom, obj]) => {
    const btn = document.createElement('button');
    btn.className = 'btn-menu';
    btn.innerHTML = `${escapeHtml(nom)}<br><span style="color:var(--accent);font-size:0.85em">${obj.prix.toFixed(2)} €</span>`;
    btn.addEventListener('click', () => {
      selection[nom] = !selection[nom];
      btn.style.outline = selection[nom] ? '3px solid var(--accent)' : '';
      recalc();
    });
    menu.appendChild(btn);
  });

  footer.style.display = 'grid';
  footer.style.gridTemplateColumns = '1fr 1fr';
  footer.style.gap = '4px';
  footer.style.padding = '4px';

  const btnRetour = document.createElement('button');
  btnRetour.className = 'btn-menu orange';
  btnRetour.textContent = '⬅ Retour';
  btnRetour.addEventListener('click', () => afficherViandes(typePlat));
  footer.appendChild(btnRetour);

  const btnValider = document.createElement('button');
  btnValider.className = 'btn-menu vert';
  btnValider.textContent = '✅ Valider';
  btnValider.addEventListener('click', () => {
    ajouterArticle(`${typePlat} ${viande}`, totalVar, objViande.tva);
    afficherCategories();
  });
  footer.appendChild(btnValider);
}

function ajouterBoutonRetour(footer, action) {
  const btn = document.createElement('button');
  btn.className = 'btn-menu orange';
  btn.textContent = '⬅ Retour';
  btn.addEventListener('click', action);
  footer.appendChild(btn);
}

function rafraichirPanier({ total, panier }) {
  const liste = document.getElementById('panier-liste');
  const totalEl = document.getElementById('panier-total');
  const ecranTotal = document.getElementById('ecran-total');
  liste.innerHTML = '';
  if (!panier.length) {
    liste.innerHTML = '<div id="panier-vide">Panier vide</div>';
  } else {
    panier.forEach((item, i) => {
      const ligne = document.createElement('div');
      ligne.className = 'panier-ligne';
      const libelle = (item.quantite > 1 ? item.quantite + ' x ' : '') + item.nom;
      ligne.innerHTML = `
        <span class="panier-nom">${escapeHtml(libelle)}</span>
        <span class="panier-tva">${item.tva}%</span>
        <span class="panier-prix">${(item.prixUnitaire * item.quantite).toFixed(2)} €</span>
        <button class="panier-suppr" data-action="supprimerLigne" data-args="[${i}]">✕</button>`;
      liste.appendChild(ligne);
    });
  }
  totalEl.textContent = 'TOTAL : ' + total.toFixed(2) + ' €';
  ecranTotal.textContent = total.toFixed(2) + ' €';
  const sc = document.getElementById('panier-scroll');
  sc.scrollTop = sc.scrollHeight;
}
