/**
 * ui-menu.js — Navigation du menu de vente (catégories → articles →
 * viandes → options) et affichage du panier. Utilise l'API DOM
 * directement : cette partie ne nécessite pas de moteur de gabarits.
 *
 * Deux logiques de prix coexistent pour les plats :
 *  - format "additif" (ex. Mitraillette, Assiette) : prix = format + viande ;
 *  - format "à prix fixes" (ex. Durum, Kapsalon : champ `prixFixes`) : la
 *    liste des choix et leurs prix sont propres au format, et ne
 *    dépendent pas de la liste générale des viandes.
 * Dans les deux cas, la page des suppléments est toujours proposée
 * ensuite.
 *
 * Les articles marqués "promotion" dans le catalogue affichent un petit
 * badge 🏷️ sur leur bouton — purement visuel.
 *
 * La catégorie "Divers" peut contenir un article spécial "Ristourne"
 * (repéré par `special: 'ristourne'`) : il ouvre une pop-up dédiée pour
 * saisir un montant et un taux de TVA, et ajoute une ligne négative.
 */
import { getCatalogue } from './catalogue.js';
import { ajouterArticle, supprimerArticle, getPanier, getTotal, onChangement } from './panier.js';
import { getMode, onModeChange, tvaEffective } from './consommation.js';
import { enregistrerAction, escapeHtml } from './ui-modal.js';
import { ouvrirRistournePopup } from './ui-ristourne.js';

const elMenu = () => document.getElementById('zone-menu');
const elFooter = () => document.getElementById('zone-footer');

const arrondi = (x) => Math.round(x * 100) / 100;

export function initUiMenu() {
  enregistrerAction('supprimerLigne', (index) => supprimerArticle(index));
  onChangement(rafraichirPanier);
  // Le taux affiché dans le panier dépend du mode (sur place / à emporter)
  onModeChange(() => rafraichirPanier({ total: getTotal(), panier: getPanier() }));
  afficherCategories();
  rafraichirPanier({ total: getTotal(), panier: getPanier() });
}

function badge(obj) {
  return obj.promo ? '🏷️ ' : '';
}

function prixHtml(prix) {
  return `<span style="color:var(--accent);font-size:0.85em">${prix.toFixed(2)} €</span>`;
}

function reinitialiserEcran() {
  const menu = elMenu();
  const footer = elFooter();
  menu.innerHTML = '';
  footer.innerHTML = '';
  footer.style.display = '';
  footer.style.gridTemplateColumns = '';
  footer.style.gap = '';
  footer.style.padding = '';
  menu.style.gridTemplateColumns = 'repeat(3, 1fr)';
  return { menu, footer };
}

export function afficherCategories() {
  const { menu } = reinitialiserEcran();
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
  const { menu, footer } = reinitialiserEcran();
  const catalogue = getCatalogue();

  if (categorie === 'Plats') {
    Object.entries(catalogue.categories.Plats.types).forEach(([nom, obj]) => {
      const btn = document.createElement('button');
      btn.className = 'btn-menu';
      btn.textContent = badge(obj) + nom;
      btn.addEventListener('click', () => afficherViandes(nom));
      menu.appendChild(btn);
    });
  } else {
    Object.entries(catalogue.categories[categorie]).forEach(([nom, obj]) => {
      const btn = document.createElement('button');
      btn.className = 'btn-menu';
      if (obj.special === 'ristourne') {
        btn.innerHTML = `${badge(obj)}${escapeHtml(nom)}<br><span style="color:var(--accent);font-size:0.8em">Montant variable</span>`;
        btn.addEventListener('click', () => ouvrirRistournePopup());
      } else {
        btn.innerHTML = `${badge(obj)}${escapeHtml(nom)}<br>${prixHtml(obj.prix)}`;
        btn.addEventListener('click', () => ajouterArticle(nom, obj.prix, obj.tva));
      }
      menu.appendChild(btn);
    });
  }

  ajouterBoutonRetour(footer, afficherCategories);
}

// Choix de la viande (ou de la variante) pour un format donné.
function afficherViandes(typePlat) {
  const { menu, footer } = reinitialiserEcran();
  const catalogue = getCatalogue();
  const type = catalogue.categories.Plats.types[typePlat];

  if (type.prixFixes) {
    // Format à prix fixes : choix et prix propres à ce format
    Object.entries(type.prixFixes).forEach(([nom, obj]) => {
      const tva = obj.tva !== undefined ? obj.tva : type.tva;
      const btn = document.createElement('button');
      btn.className = 'btn-menu';
      btn.innerHTML = `${badge(obj)}${escapeHtml(nom)}<br>${prixHtml(obj.prix)}`;
      btn.addEventListener('click', () => afficherOptions(typePlat, nom, { prix: obj.prix, tva }));
      menu.appendChild(btn);
    });
  } else {
    // Format additif : prix du format + prix de la viande
    Object.entries(catalogue.categories.Plats.viandes).forEach(([nom, obj]) => {
      const prix = arrondi(type.prix + obj.prix);
      const btn = document.createElement('button');
      btn.className = 'btn-menu';
      btn.innerHTML = `${badge(obj)}${escapeHtml(nom)}<br>${prixHtml(prix)}`;
      btn.addEventListener('click', () => afficherOptions(typePlat, nom, { prix, tva: obj.tva }));
      menu.appendChild(btn);
    });
  }

  ajouterBoutonRetour(footer, () => afficherArticles('Plats'));
}

// Page des suppléments, toujours proposée après le choix du plat.
// `base` = { prix, tva } du plat choisi (avant suppléments).
function afficherOptions(typePlat, choix, base) {
  const { menu, footer } = reinitialiserEcran();
  menu.style.gridTemplateColumns = 'repeat(2, 1fr)';
  const catalogue = getCatalogue();
  const selection = {};
  let totalVar = base.prix;

  const label = document.createElement('div');
  label.style.cssText = 'grid-column:1/-1;color:var(--accent);font-size:18px;font-weight:bold;text-align:center;padding:6px;';
  label.textContent = 'TOTAL : ' + totalVar.toFixed(2) + ' €';
  menu.appendChild(label);

  function recalc() {
    let extra = 0;
    Object.entries(selection).forEach(([n, v]) => { if (v) extra += catalogue.supplements[n].prix; });
    totalVar = arrondi(base.prix + extra);
    label.textContent = 'TOTAL : ' + totalVar.toFixed(2) + ' €';
  }

  // Certains suppléments ne s'appliquent qu'à certains formats
  // (champ `formats`, ex. "Frites + Sauces" pour Pain rond/Poche/Durum).
  Object.entries(catalogue.supplements)
    .filter(([, obj]) => !obj.formats || obj.formats.includes(typePlat))
    .forEach(([nom, obj]) => {
      const btn = document.createElement('button');
      btn.className = 'btn-menu';
      btn.innerHTML = `${badge(obj)}${escapeHtml(nom)}<br>${prixHtml(obj.prix)}`;
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
    ajouterArticle(`${typePlat} ${choix}`, totalVar, base.tva);
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
  const mode = getMode();
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
        <span class="panier-tva">${tvaEffective(item.tva, mode)}%</span>
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
