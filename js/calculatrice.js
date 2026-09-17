/**
 * calculatrice.js — Logique pure de la calculette du panier ("Montant libre").
 * Le résultat validé est ajouté au panier avec un taux de TVA par défaut
 * de 6% (choix retenu pour les saisies manuelles, majoritairement de la
 * nourriture à emporter).
 */
import { ajouterArticle } from './panier.js';

const TVA_MONTANT_LIBRE = 6;

export function creerCalculatrice() {
  let expression = '';

  function saisir(val) {
    if ('+-*/'.includes(val)) {
      if (!expression || '+-*/'.includes(expression.slice(-1))) return expression;
    }
    if (val === '.') {
      if (!expression || '+-*/'.includes(expression.slice(-1))) return expression;
      const dernier = expression.split(/[+\-*/]/).pop();
      if (dernier.includes('.')) return expression;
    }
    if (!isNaN(val)) {
      const dernier = expression.split(/[+\-*/]/).pop();
      if (dernier.includes('.') && dernier.split('.')[1].length >= 2) return expression;
    }
    expression += val;
    return expression;
  }

  function valider() {
    if (!expression || '+-*/'.includes(expression.slice(-1))) {
      expression = '';
      return { erreur: true };
    }
    try {
      const resultat = Function('"use strict"; return (' + expression + ')')();
      if (resultat < 0 || !isFinite(resultat)) throw new Error('Résultat invalide');
      const r = Math.round(resultat * 100) / 100;
      ajouterArticle('Montant libre', r, TVA_MONTANT_LIBRE);
      expression = '';
      return { erreur: false, valeur: r };
    } catch {
      expression = '';
      return { erreur: true };
    }
  }

  return {
    saisir,
    valider,
    getExpression: () => expression
  };
}
