/**
 * ui-parametres.js — Écran de configuration : identifiant de cette
 * caisse (traçabilité + numérotation de secours) et jeton d'accès
 * GitHub, avec pastille d'indication du statut de synchronisation.
 *
 * Le propriétaire et le nom du dépôt privé sont fixés dans config.js
 * (DEPOT_PRIVE) — non sensibles, identiques pour tous les appareils.
 * SEUL le jeton reste propre à cet appareil (localStorage), jamais
 * transmis ailleurs qu'à l'API GitHub : après un vidage du cache du
 * navigateur, c'est la seule chose à ressaisir pour reconnecter cet
 * appareil.
 */
import { DEPOT_PRIVE } from './config.js';
import { Stockage } from './stockage.js';
import { modal, fermerModal, escapeHtml } from './ui-modal.js';
import { getConfigGithub, sauvegarderTokenGithub, onStatutChange, testerConnexionGithub } from './github-sync.js';

export function initUiParametres() {
  onStatutChange(mettreAJourPastille);
  const config = getConfigGithub();
  mettreAJourPastille({ configure: !!(config && config.token), enAttente: 0, enTraitement: false });
}

function mettreAJourPastille({ configure, enAttente }) {
  let pastille = document.getElementById('pastille-sync');
  if (!pastille) {
    pastille = document.createElement('div');
    pastille.id = 'pastille-sync';
    pastille.style.cssText = 'position:fixed;top:6px;right:6px;font-size:10px;padding:3px 7px;border-radius:10px;z-index:150;color:white;pointer-events:none;';
    document.body.appendChild(pastille);
  }
  if (!configure) {
    pastille.style.background = '#B71C1C';
    pastille.style.display = 'block';
    pastille.textContent = '⚠️ GitHub non configuré';
    return;
  }
  pastille.style.display = 'block';
  if (enAttente > 0) {
    pastille.style.background = '#E65100';
    pastille.textContent = `⏳ ${enAttente} en attente`;
  } else {
    pastille.style.background = '#2E7D32';
    pastille.textContent = '✅ GitHub à jour';
  }
}

function nettoyerIdentifiant(brut) {
  return brut.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 10);
}

export function ouvrirParametres(onRetour) {
  const config = getConfigGithub();
  const retour = onRetour || fermerModal;
  const identifiantActuel = Stockage.obtenirOuGenererIdentifiantCaisse();

  const conteneur = document.createElement('div');
  conteneur.innerHTML = `<h2>Paramètres</h2>

    <div class="section-titre" style="margin-top:0">Identifiant de cette caisse</div>
    <p class="confirm-txt" style="font-size:12px">
      Sert de traçabilité ("quel appareil a fait cette vente") et de repli en cas de
      panne réseau prolongée. Un identifiant a été généré automatiquement ; tu peux le
      remplacer par quelque chose de plus parlant (ex. "A", "COMPTOIR").
      <strong>Doit être différent sur chaque appareil.</strong>
    </p>
    <input id="champ-identifiant" type="text" value="${escapeHtml(identifiantActuel)}" maxlength="10"
      style="width:100%;padding:10px;background:#333;color:white;border:none;border-radius:6px;font-size:15px;margin-bottom:14px;text-transform:uppercase">

    <div class="section-titre">Connexion au dépôt privé</div>
    <p class="confirm-txt" style="font-size:12px">
      Dépôt : <strong>${escapeHtml(DEPOT_PRIVE.owner)}/${escapeHtml(DEPOT_PRIVE.repo)}</strong> (fixé pour tous les appareils).
      Seul le jeton ci-dessous est propre à CET appareil — c'est la seule chose à
      ressaisir si tu vides un jour le cache du navigateur.
    </p>
    <div style="margin-bottom:8px">
      <label style="color:#aaa;font-size:13px">Jeton d'accès</label>
      <input id="champ-token" type="password" placeholder="${config && config.token ? '••••••••••• (déjà configuré)' : 'ghp_...'}" style="width:100%;padding:10px;background:#333;color:white;border:none;border-radius:6px;font-size:15px;margin-top:4px">
    </div>
    <div id="resultat-test" class="confirm-txt" style="font-size:13px;min-height:18px"></div>
    <div class="modal-actions">
      <button class="btn-modal rouge" id="btn-fermer-param">⬅ Retour</button>
      <button class="btn-modal gris" id="btn-tester">🔎 Tester</button>
      <button class="btn-modal vert full" id="btn-enregistrer">✅ Enregistrer</button>
    </div>`;

  conteneur.querySelector('#btn-fermer-param').addEventListener('click', retour);

  conteneur.querySelector('#btn-tester').addEventListener('click', async () => {
    const c = lireConfigTest(conteneur, config);
    const zone = conteneur.querySelector('#resultat-test');
    if (!c) { zone.innerHTML = '<span style="color:red">❌ Entre un jeton d\'abord</span>'; return; }
    zone.textContent = 'Test en cours...';
    const resultat = await testerConnexionGithub(c);
    zone.innerHTML = resultat.ok
      ? '<span style="color:#66BB6A">✅ Connexion réussie</span>'
      : `<span style="color:red">❌ ${escapeHtml(resultat.message)}</span>`;
  });

  conteneur.querySelector('#btn-enregistrer').addEventListener('click', () => {
    const identifiant = nettoyerIdentifiant(conteneur.querySelector('#champ-identifiant').value) || identifiantActuel;
    Stockage.definirIdentifiantCaisse(identifiant);

    const nouveauToken = conteneur.querySelector('#champ-token').value.trim();
    if (nouveauToken) sauvegarderTokenGithub(nouveauToken);

    retour();
  });

  modal(conteneur);
}

function lireConfigTest(conteneur, config) {
  const nouveauToken = conteneur.querySelector('#champ-token').value.trim();
  const token = nouveauToken || (config && config.token);
  if (!token) return null;
  return { owner: DEPOT_PRIVE.owner, repo: DEPOT_PRIVE.repo, token };
}
