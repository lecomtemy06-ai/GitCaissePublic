/**
 * ui-parametres.js — Écran de configuration : identifiant de cette
 * caisse (préfixe des numéros de ticket) et synchronisation GitHub
 * (dépôt privé + jeton d'accès), avec pastille d'indication du statut
 * de synchronisation. Le jeton reste stocké uniquement sur cet appareil
 * (localStorage), jamais transmis ailleurs qu'à l'API GitHub.
 */
import { Stockage } from './stockage.js';
import { modal, fermerModal, escapeHtml } from './ui-modal.js';
import { getConfigGithub, sauvegarderConfigGithub, onStatutChange, testerConnexionGithub } from './github-sync.js';

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
  if (!configure) { pastille.style.display = 'none'; return; }
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
  const config = getConfigGithub() || { owner: '', repo: '', token: '' };
  const retour = onRetour || fermerModal;
  const identifiantActuel = Stockage.obtenirOuGenererIdentifiantCaisse();

  const conteneur = document.createElement('div');
  conteneur.innerHTML = `<h2>Paramètres</h2>

    <div class="section-titre" style="margin-top:0">Identifiant de cette caisse</div>
    <p class="confirm-txt" style="font-size:12px">
      Inclus dans chaque numéro de ticket (ex. "${escapeHtml(identifiantActuel)}-000001") pour que
      deux appareils ne puissent JAMAIS produire le même numéro. Un identifiant a été généré
      automatiquement ; tu peux le remplacer par quelque chose de plus parlant (ex. "A", "COMPTOIR").
      <strong>Doit être différent sur chaque appareil.</strong>
    </p>
    <input id="champ-identifiant" type="text" value="${escapeHtml(identifiantActuel)}" maxlength="10"
      style="width:100%;padding:10px;background:#333;color:white;border:none;border-radius:6px;font-size:15px;margin-bottom:14px;text-transform:uppercase">

    <div class="section-titre">Synchronisation GitHub</div>
    <p class="confirm-txt" style="font-size:12px">Jeton "fine-grained" limité en lecture/écriture à ce seul dépôt privé. Il reste stocké uniquement sur cet appareil.</p>
    <div style="margin-bottom:8px">
      <label style="color:#aaa;font-size:13px">Propriétaire (compte GitHub)</label>
      <input id="champ-owner" type="text" value="${escapeHtml(config.owner)}" style="width:100%;padding:10px;background:#333;color:white;border:none;border-radius:6px;font-size:15px;margin-top:4px">
    </div>
    <div style="margin-bottom:8px">
      <label style="color:#aaa;font-size:13px">Nom du dépôt privé</label>
      <input id="champ-repo" type="text" value="${escapeHtml(config.repo)}" style="width:100%;padding:10px;background:#333;color:white;border:none;border-radius:6px;font-size:15px;margin-top:4px">
    </div>
    <div style="margin-bottom:8px">
      <label style="color:#aaa;font-size:13px">Jeton d'accès</label>
      <input id="champ-token" type="password" placeholder="${config.token ? '••••••••••• (déjà configuré)' : 'ghp_...'}" style="width:100%;padding:10px;background:#333;color:white;border:none;border-radius:6px;font-size:15px;margin-top:4px">
    </div>
    <div id="resultat-test" class="confirm-txt" style="font-size:13px;min-height:18px"></div>
    <div class="modal-actions">
      <button class="btn-modal rouge" id="btn-fermer-param">⬅ Retour</button>
      <button class="btn-modal gris" id="btn-tester">🔎 Tester</button>
      <button class="btn-modal vert full" id="btn-enregistrer">✅ Enregistrer</button>
    </div>`;

  conteneur.querySelector('#btn-fermer-param').addEventListener('click', retour);

  conteneur.querySelector('#btn-tester').addEventListener('click', async () => {
    const c = lireChampsGithub(conteneur, config);
    const zone = conteneur.querySelector('#resultat-test');
    zone.textContent = 'Test en cours...';
    const resultat = await testerConnexionGithub(c);
    zone.innerHTML = resultat.ok
      ? '<span style="color:#66BB6A">✅ Connexion réussie</span>'
      : `<span style="color:red">❌ ${escapeHtml(resultat.message)}</span>`;
  });

  conteneur.querySelector('#btn-enregistrer').addEventListener('click', () => {
    const identifiant = nettoyerIdentifiant(conteneur.querySelector('#champ-identifiant').value) || identifiantActuel;
    Stockage.definirIdentifiantCaisse(identifiant);

    const c = lireChampsGithub(conteneur, config);
    sauvegarderConfigGithub(c);
    retour();
  });

  modal(conteneur);
}

function lireChampsGithub(conteneur, config) {
  const owner = conteneur.querySelector('#champ-owner').value.trim();
  const repo = conteneur.querySelector('#champ-repo').value.trim();
  const nouveauToken = conteneur.querySelector('#champ-token').value.trim();
  return { owner, repo, token: nouveauToken || config.token };
}
