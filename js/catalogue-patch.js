/**
 * catalogue-patch.js — Applique une modification PONCTUELLE (patch) à un
 * objet catalogue, plutôt que de remplacer le catalogue entier.
 *
 * C'est la pièce centrale qui permet la synchronisation multi-appareils
 * sans perte de données : au lieu que chaque appareil pousse tout son
 * catalogue local (et écrase ainsi les ajouts faits entre-temps par un
 * autre appareil), chaque appareil décrit UNIQUEMENT ce qu'il a changé.
 * Ce module est utilisé à la fois :
 *  - en local (catalogue.js), pour appliquer immédiatement le changement
 *    à l'écran ;
 *  - lors de la synchronisation (github-sync.js), pour appliquer ce même
 *    changement à la version la PLUS RÉCENTE du fichier sur GitHub,
 *    quels que soient les autres changements survenus entre-temps.
 *
 * Aucune dépendance : ce module ne connaît ni le DOM, ni le stockage,
 * ni le réseau.
 */

function conteneurPour(catalogue, cat) {
  if (cat === 'Plats-types') {
    if (!catalogue.categories.Plats) catalogue.categories.Plats = { types: {}, viandes: {} };
    return catalogue.categories.Plats.types;
  }
  if (cat === 'Plats-viandes') {
    if (!catalogue.categories.Plats) catalogue.categories.Plats = { types: {}, viandes: {} };
    return catalogue.categories.Plats.viandes;
  }
  if (cat === 'SUPPLEMENTS') {
    if (!catalogue.supplements) catalogue.supplements = {};
    return catalogue.supplements;
  }
  if (!catalogue.categories[cat]) catalogue.categories[cat] = {};
  return catalogue.categories[cat];
}

// Mute `catalogue` en lui appliquant `patch`, et le retourne.
export function appliquerPatchCatalogue(catalogue, patch) {
  if (!patch) return catalogue;
  const conteneur = conteneurPour(catalogue, patch.cat);

  switch (patch.op) {
    case 'prix':
      if (conteneur[patch.nom]) conteneur[patch.nom].prix = patch.valeur;
      break;
    case 'tva':
      if (conteneur[patch.nom]) conteneur[patch.nom].tva = patch.valeur;
      break;
    case 'promo':
      if (conteneur[patch.nom]) conteneur[patch.nom].promo = !!patch.valeur;
      break;
    case 'renommer':
      if (conteneur[patch.nomActuel] && patch.nouveauNom !== patch.nomActuel) {
        conteneur[patch.nouveauNom] = conteneur[patch.nomActuel];
        delete conteneur[patch.nomActuel];
      }
      break;
    case 'supprimer':
      delete conteneur[patch.nom];
      break;
    case 'ajouter':
      conteneur[patch.nom] = { prix: patch.prix, tva: patch.tva, promo: !!patch.promo };
      break;
    default:
      console.warn('Patch catalogue inconnu :', patch);
  }
  return catalogue;
}

export function decrirePatch(patch) {
  switch (patch.op) {
    case 'prix': return `Prix "${patch.nom}" -> ${patch.valeur.toFixed(2)} €`;
    case 'tva': return `TVA "${patch.nom}" -> ${patch.valeur}%`;
    case 'promo': return `Promotion "${patch.nom}" -> ${patch.valeur ? 'activée' : 'désactivée'}`;
    case 'renommer': return `Renommage "${patch.nomActuel}" -> "${patch.nouveauNom}"`;
    case 'supprimer': return `Suppression "${patch.nom}"`;
    case 'ajouter': return `Ajout "${patch.nom}"`;
    default: return 'Modification du catalogue';
  }
}
