/**
 * ui-gestion.js — Écran protégé par mot de passe : gestion des prix, des
 * taux de TVA, ajout/suppression/renommage d'articles, et accès à la
 * liste des clôtures et aux paramètres de synchronisation GitHub.
 */
import { MDP_GESTION } from './config.js';
import {
  getCatalogue, modifierPrix, cyclerTva, basculerPromo, renommerArticle,
  supprimerArticle, ajouterArticleCatalogue
} from './catalogue.js';
import { modal, fermerModal, escapeHtml, enregistrerAction, attrArgs } from './ui-modal.js';
import { creerPaveNumerique, creerClavierAzerty } from './clavier.js';
import { ouvrirListeClotures } from './ui-historique.js';
import { ouvrirParametres } from './ui-parametres.js';

export function initUiGestion() {
  document.getElementById('logo-btn').addEventListener('click', demanderMDP);
  enregistrerAction('ouvrirGestionPrix', ouvrirGestionPrix);
  enregistrerAction('popupAjoutArticle', popupAjoutArticle);
  enregistrerAction('ouvrirModifPrix', ouvrirModifPrix);
  enregistrerAction('cyclerTvaUi', cyclerTvaUi);
  enregistrerAction('basculerPromoUi', basculerPromoUi);
  enregistrerAction('ouvrirRenommer', ouvrirRenommer);
  enregistrerAction('demanderSuppressionArticle', demanderSuppressionArticle);
  enregistrerAction('confirmerSuppressionArticle', confirmerSuppressionArticle);
  enregistrerAction('ouvrirParametres', () => ouvrirParametres(ouvrirGestionPrix));
}

function demanderMDP() {
  let saisie = '';
  const conteneur = document.createElement('div');
  const titre = document.createElement('h2');
  titre.textContent = 'Accès Gestion des Prix';
  const ecran = document.createElement('div');
  ecran.className = 'modal-ecran';
  ecran.style.letterSpacing = '8px';
  const erreur = document.createElement('div');
  erreur.className = 'error-txt';

  const pave = creerPaveNumerique((touche) => {
    saisie = touche === 'C' ? '' : saisie + touche;
    ecran.textContent = '*'.repeat(saisie.length);
    erreur.textContent = '';
  });

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const btnRetour = document.createElement('button');
  btnRetour.className = 'btn-modal rouge';
  btnRetour.textContent = '⬅ Retour';
  btnRetour.addEventListener('click', fermerModal);
  const btnValider = document.createElement('button');
  btnValider.className = 'btn-modal vert';
  btnValider.textContent = '✅ Valider';
  btnValider.addEventListener('click', () => {
    if (saisie === MDP_GESTION) { fermerModal(); ouvrirGestionPrix(); }
    else { erreur.textContent = 'Mot de passe erroné'; saisie = ''; ecran.textContent = ''; }
  });
  actions.append(btnRetour, btnValider);

  conteneur.append(titre, ecran, erreur, pave, actions);
  modal(conteneur);
}

export function ouvrirGestionPrix() {
  modal(construireEcranGestion());
}

function construireEcranGestion() {
  const catalogue = getCatalogue();
  let h = `<h2>Gestion des prix</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <button class="btn-modal vert" data-action="popupAjoutArticle">➕ Ajouter article</button>
      <button class="btn-modal gris" data-action="ouvrirListeClotures">📜 Clôtures</button>
    </div>
    <button class="btn-modal bleu full" style="margin-bottom:10px" data-action="ouvrirParametres">⚙️ Paramètres (synchronisation GitHub)</button>
    <p class="confirm-txt" style="font-size:11.5px;margin:4px 0 10px">Touchez le prix pour le modifier, ou le taux de TVA pour le faire changer (6% → 12% → 21%).</p>
    <div class="gestion-scroll">`;

  for (const [cat, contenu] of Object.entries(catalogue.categories)) {
    h += `<div class="section-titre">${escapeHtml(cat)}</div>`;
    if (cat === 'Plats') {
      h += `<div style="color:#aaa;font-size:12px;padding:4px 0">-- Types --</div>`;
      for (const [nom, obj] of Object.entries(contenu.types)) h += ligneArticle('Plats-types', nom, obj);
      h += `<div style="color:#aaa;font-size:12px;padding:4px 0">-- Viandes --</div>`;
      for (const [nom, obj] of Object.entries(contenu.viandes)) h += ligneArticle('Plats-viandes', nom, obj);
    } else {
      for (const [nom, obj] of Object.entries(contenu)) h += ligneArticle(cat, nom, obj);
    }
  }
  h += `<div class="section-titre">SUPPLÉMENTS</div>`;
  for (const [nom, obj] of Object.entries(catalogue.supplements)) h += ligneArticle('SUPPLEMENTS', nom, obj);

  h += `</div><button class="btn-modal rouge full" style="margin-top:10px" data-action="fermerModal">✕ Fermer</button>`;
  return h;
}

function ligneArticle(cat, nom, obj) {
  if (obj.special === 'ristourne') {
    return `<div class="article-ligne">
      <span class="article-nom">${obj.promo ? '🏷️ ' : ''}${escapeHtml(nom)}</span>
      <span style="color:#888;font-size:11px;flex:1">Article spécial — montant et TVA saisis à chaque vente</span>
      <button class="btn-edit" data-action="ouvrirRenommer" data-args="${attrArgs([cat, nom])}">✏️</button>
      <button class="btn-del" data-action="demanderSuppressionArticle" data-args="${attrArgs([cat, nom])}">🗑</button>
    </div>`;
  }
  return `<div class="article-ligne">
    <span class="article-nom">${obj.promo ? '🏷️ ' : ''}${escapeHtml(nom)}</span>
    <button class="btn-prix" data-action="ouvrirModifPrix" data-args="${attrArgs([cat, nom])}">${obj.prix.toFixed(2)} €</button>
    <button class="btn-tva" data-action="cyclerTvaUi" data-args="${attrArgs([cat, nom])}" title="Toucher pour changer le taux">${obj.tva}%</button>
    <button class="btn-tva" style="${obj.promo ? 'background:#F57F17;color:white;border-color:#F57F17' : ''}" data-action="basculerPromoUi" data-args="${attrArgs([cat, nom])}" title="Marquer/démarquer comme promotion">🏷️</button>
    <button class="btn-edit" data-action="ouvrirRenommer" data-args="${attrArgs([cat, nom])}">✏️</button>
    <button class="btn-del" data-action="demanderSuppressionArticle" data-args="${attrArgs([cat, nom])}">🗑</button>
  </div>`;
}

function cyclerTvaUi(cat, nom) {
  cyclerTva(cat, nom);
  ouvrirGestionPrix();
}

function basculerPromoUi(cat, nom) {
  basculerPromo(cat, nom);
  ouvrirGestionPrix();
}

function ouvrirModifPrix(cat, nom) {
  let saisie = '';
  const conteneur = document.createElement('div');
  const titre = document.createElement('h2');
  titre.textContent = 'Modifier prix';
  const sousTitre = document.createElement('div');
  sousTitre.style.cssText = 'color:#ccc;text-align:center;margin-bottom:5px';
  sousTitre.textContent = nom;
  const ecran = document.createElement('div');
  ecran.className = 'modal-ecran';

  const pave = creerPaveNumerique((touche) => {
    saisie = touche === 'C' ? '' : saisie + touche;
    ecran.textContent = saisie;
  });

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const btnRetour = document.createElement('button');
  btnRetour.className = 'btn-modal rouge';
  btnRetour.textContent = '⬅ Retour';
  btnRetour.addEventListener('click', ouvrirGestionPrix);
  const btnValider = document.createElement('button');
  btnValider.className = 'btn-modal vert';
  btnValider.textContent = '✅ Valider';
  btnValider.addEventListener('click', () => {
    const p = parseFloat(saisie);
    if (isNaN(p)) return;
    modifierPrix(cat, nom, p);
    ouvrirGestionPrix();
  });
  actions.append(btnRetour, btnValider);

  conteneur.append(titre, sousTitre, ecran, pave, actions);
  modal(conteneur);
}

function ouvrirRenommer(cat, nomActuel) {
  let saisie = nomActuel;
  const conteneur = document.createElement('div');
  const titre = document.createElement('h2');
  titre.textContent = 'Renommer';
  const sousTitre = document.createElement('div');
  sousTitre.style.cssText = 'color:#ccc;text-align:center;margin-bottom:8px';
  sousTitre.textContent = 'Actuel : ' + nomActuel;
  const ecran = document.createElement('div');
  ecran.className = 'modal-ecran';
  ecran.style.cssText = 'font-size:18px;text-align:left';
  ecran.textContent = saisie;

  const clavier = creerClavierAzerty((touche) => {
    if (touche === 'BACK') saisie = saisie.slice(0, -1);
    else if (touche === 'SPC') saisie += ' ';
    else saisie += touche;
    ecran.textContent = saisie;
  });

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const btnRetour = document.createElement('button');
  btnRetour.className = 'btn-modal rouge';
  btnRetour.textContent = '⬅ Retour';
  btnRetour.addEventListener('click', ouvrirGestionPrix);
  const btnValider = document.createElement('button');
  btnValider.className = 'btn-modal vert';
  btnValider.textContent = '✅ Valider';
  btnValider.addEventListener('click', () => {
    const nouveau = saisie.trim();
    if (nouveau) renommerArticle(cat, nomActuel, nouveau);
    ouvrirGestionPrix();
  });
  actions.append(btnRetour, btnValider);

  conteneur.append(titre, sousTitre, ecran, clavier, actions);
  modal(conteneur);
}

function demanderSuppressionArticle(cat, nom) {
  modal(`<h2>Confirmation</h2>
    <p class="confirm-txt">Supprimer "${escapeHtml(nom)}" ?</p>
    <div class="modal-actions">
      <button class="btn-modal rouge" data-action="ouvrirGestionPrix">NON</button>
      <button class="btn-modal vert" data-action="confirmerSuppressionArticle" data-args="${attrArgs([cat, nom])}">OUI</button>
    </div>`);
}

function confirmerSuppressionArticle(cat, nom) {
  supprimerArticle(cat, nom);
  ouvrirGestionPrix();
}

function popupAjoutArticle() {
  const catalogue = getCatalogue();
  // Catégories "à plat" (Frites, Desserts, Boissons, Divers...) + les
  // trois rubriques internes de "Plats", exposées séparément car elles
  // ne se gèrent pas de la même façon au moment de la vente : "Plats"
  // correspond aux formats (Spécial, Durum...), "Viandes" aux garnitures
  // principales, "Suppléments" aux ajouts optionnels. Un "plat" complet
  // tel que vu en caisse est toujours la combinaison, au moment de la
  // vente, d'un format + d'une viande (+ suppléments) — il n'y a donc
  // rien d'autre à ajouter "en plus" pour rendre un plat disponible :
  // ajouter un format ou une viande suffit à le proposer partout.
  const optionsCategories = [
    ...Object.keys(catalogue.categories).filter(c => c !== 'Plats').map(c => ({ valeur: c, libelle: c })),
    { valeur: 'Plats-types', libelle: 'Plats (formats)' },
    { valeur: 'Plats-viandes', libelle: 'Viandes' },
    { valeur: 'SUPPLEMENTS', libelle: 'Suppléments' }
  ];
  let nomSaisi = '';
  let prixSaisi = '';

  const conteneur = document.createElement('div');
  conteneur.innerHTML = `<h2>Ajouter un article</h2>
    <div style="margin-bottom:8px">
      <label style="color:#aaa;font-size:13px">Catégorie</label>
      <select id="sel-cat" style="width:100%;padding:8px;background:#333;color:white;border:none;border-radius:6px;font-size:16px;margin-top:4px">
        ${optionsCategories.map(o => `<option value="${escapeHtml(o.valeur)}">${escapeHtml(o.libelle)}</option>`).join('')}
      </select>
    </div>
    <div style="margin-bottom:6px">
      <label style="color:#aaa;font-size:13px">Nom de l'article</label>
      <div class="modal-ecran" id="ecran-ajout-nom" style="font-size:16px;text-align:left;margin-top:4px"></div>
    </div>
    <div style="margin-bottom:8px">
      <label style="color:#aaa;font-size:13px">Prix</label>
      <div class="modal-ecran" id="ecran-ajout-prix" style="margin-top:4px"></div>
    </div>
    <div style="margin-bottom:8px">
      <label style="color:#aaa;font-size:13px">Taux de TVA</label>
      <select id="sel-tva" style="width:100%;padding:8px;background:#333;color:white;border:none;border-radius:6px;font-size:16px;margin-top:4px">
        <option value="6">6%</option><option value="12">12%</option><option value="21">21%</option>
      </select>
    </div>
    <label style="display:flex;align-items:center;gap:8px;color:white;font-size:14px;margin-bottom:10px;cursor:pointer">
      <input type="checkbox" id="chk-ajout-promo" style="width:20px;height:20px">
      🏷️ Cet article est en promotion
    </label>
    <div id="zone-saisie" style="display:flex;gap:8px"></div>
    <div class="modal-actions" style="margin-top:10px">
      <button class="btn-modal rouge" id="btn-retour-ajout">⬅ Retour</button>
      <button class="btn-modal vert" id="btn-valider-ajout">✅ Valider</button>
    </div>`;

  const ecranNom = conteneur.querySelector('#ecran-ajout-nom');
  const ecranPrix = conteneur.querySelector('#ecran-ajout-prix');
  const zoneSaisie = conteneur.querySelector('#zone-saisie');

  const zonePave = document.createElement('div');
  zonePave.style.flex = '1';
  zonePave.appendChild(creerPaveNumerique((touche) => {
    prixSaisi = touche === 'C' ? '' : prixSaisi + touche;
    ecranPrix.textContent = prixSaisi;
  }));

  const zoneClavier = document.createElement('div');
  zoneClavier.style.flex = '2';
  zoneClavier.appendChild(creerClavierAzerty((touche) => {
    if (touche === 'BACK') nomSaisi = nomSaisi.slice(0, -1);
    else if (touche === 'SPC') nomSaisi += ' ';
    else nomSaisi += touche;
    ecranNom.textContent = nomSaisi;
  }));

  zoneSaisie.append(zonePave, zoneClavier);

  conteneur.querySelector('#btn-retour-ajout').addEventListener('click', ouvrirGestionPrix);
  conteneur.querySelector('#btn-valider-ajout').addEventListener('click', () => {
    const cat = conteneur.querySelector('#sel-cat').value;
    const tva = parseInt(conteneur.querySelector('#sel-tva').value, 10);
    const nom = nomSaisi.trim();
    const prix = parseFloat(prixSaisi);
    const promo = conteneur.querySelector('#chk-ajout-promo').checked;
    if (!cat || !nom || isNaN(prix)) return;
    ajouterArticleCatalogue(cat, nom, prix, tva, promo);
    ouvrirGestionPrix();
  });

  modal(conteneur);
}
