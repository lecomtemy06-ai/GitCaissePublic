/**
 * panier.js — État et logique du panier de la vente en cours.
 * Ne touche jamais au DOM : les modules d'interface s'abonnent aux
 * changements via onChangement() pour rafraîchir leur affichage.
 */

let total = 0;
let panier = []; // [{nom, prixUnitaire, tva, quantite}]
const ecouteurs = [];

export function onChangement(fn) {
  ecouteurs.push(fn);
}

function notifier() {
  ecouteurs.forEach(fn => fn({ total, panier }));
}

export function getTotal() {
  return total;
}

export function getPanier() {
  return panier;
}

function trouverLigneExistante(nom, prixUnitaire, tva) {
  return panier.findIndex(l => l.nom === nom && Math.abs(l.prixUnitaire - prixUnitaire) < 0.001 && l.tva === tva);
}

export function ajouterArticle(nom, prixUnitaire, tva) {
  const idx = trouverLigneExistante(nom, prixUnitaire, tva);
  if (idx >= 0) panier[idx].quantite++;
  else panier.push({ nom, prixUnitaire, tva, quantite: 1 });
  total = Math.round((total + prixUnitaire) * 100) / 100;
  notifier();
}

export function supprimerArticle(index) {
  const ligne = panier[index];
  if (!ligne) return;
  ligne.quantite--;
  total = Math.round((total - ligne.prixUnitaire) * 100) / 100;
  if (ligne.quantite <= 0) panier.splice(index, 1);
  notifier();
}

export function vider() {
  total = 0;
  panier = [];
  notifier();
}
