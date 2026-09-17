/**
 * export.js — Génération de fichiers exportables (CSV, JSON) et écriture
 * optionnelle dans un dossier local choisi par l'utilisateur (File System
 * Access API, disponible uniquement sur Chrome/Edge PC/Android).
 * Fonctionnalité indépendante de la synchronisation GitHub : c'est une
 * sauvegarde "bonus" en plus, pas un remplacement.
 */
import { Stockage } from './stockage.js';
import { toutesLesVentes, ventesDuJour, dateComptable } from './ventes.js';
import { getCatalogue } from './catalogue.js';
import { listerClotures } from './cloture.js';

export function telechargerFichier(nom, contenu, mime = 'text/plain') {
  const blob = new Blob([contenu], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function csvEchappe(v) {
  const s = String(v);
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function construireCsvVentes(ventes) {
  const lignes = ['NumTicket;DateComptable;DateHeure;Appareil;Article;Quantite;PrixUnitaireTTC;TauxTVA;TotalLigneTTC;ModePaiement;TotalTicketTTC'];
  ventes.forEach(v => {
    v.lignes.forEach(l => {
      lignes.push([
        v.numero, v.dateComptable, v.dateAffichee + ' ' + v.heureAffichee, v.appareil || '',
        csvEchappe(l.nom), l.quantite, l.prixUnitaire.toFixed(2), l.tva,
        (l.prixUnitaire * l.quantite).toFixed(2), v.modePaiement, v.totalTTC.toFixed(2)
      ].join(';'));
    });
  });
  return lignes.join('\n');
}

export function exporterVentesCSV(toutes) {
  const date = dateComptable();
  const ventes = toutes ? toutesLesVentes() : ventesDuJour(date);
  if (!ventes.length) return false;
  telechargerFichier(toutes ? `ventes_completes_${date}.csv` : `ventes_${date}.csv`, construireCsvVentes(ventes), 'text/csv');
  return true;
}

export function exporterSauvegardeJSON() {
  const data = {
    exportLe: new Date().toISOString(),
    catalogue: getCatalogue(),
    ventes: toutesLesVentes(),
    clotures: listerClotures(),
    identifiantCaisse: Stockage.chargerIdentifiantCaisse(),
    blocTickets: Stockage.chargerBlocTickets(),
    blocTicketsEnAttente: Stockage.chargerBlocEnAttente(),
    compteurSecours: Stockage.chargerCompteurSecours()
  };
  telechargerFichier(`sauvegarde_caisse_${dateComptable()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

export function restaurerSauvegarde(data) {
  if (data.catalogue) Stockage.sauvegarderCatalogue(data.catalogue);
  if (data.ventes) Stockage.sauvegarderVentes(data.ventes);
  if (data.clotures) Stockage.sauvegarderClotures(data.clotures);
  if (data.identifiantCaisse) Stockage.definirIdentifiantCaisse(data.identifiantCaisse);
  if (data.blocTickets) Stockage.sauvegarderBlocTickets(data.blocTickets);
  if (data.blocTicketsEnAttente) Stockage.sauvegarderBlocEnAttente(data.blocTicketsEnAttente);
  if (data.compteurSecours) Stockage.sauvegarderCompteurSecours(data.compteurSecours);
}

// ===== Dossier local (File System Access API — PC/Android Chrome-Edge) =====
let dossierHandle = null;
const FS_DB_NAME = 'caisse_fs_db';
const FS_STORE = 'handles';

function ouvrirFsDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FS_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(FS_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function sauvegarderHandleDossier(handle) {
  try {
    const db = await ouvrirFsDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FS_STORE, 'readwrite');
      tx.objectStore(FS_STORE).put(handle, 'dossierExport');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { console.warn('Sauvegarde du dossier impossible', e); }
}

async function chargerHandleDossier() {
  try {
    const db = await ouvrirFsDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(FS_STORE, 'readonly');
      const req = tx.objectStore(FS_STORE).get('dossierExport');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export function supporteDossierLocal() {
  return 'showDirectoryPicker' in window;
}

export function getDossierActif() {
  return dossierHandle;
}

export async function choisirDossierExport() {
  if (!supporteDossierLocal()) return null;
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  dossierHandle = handle;
  await sauvegarderHandleDossier(handle);
  return handle;
}

export async function initDossierExport(surReconnexionRequise) {
  if (!supporteDossierLocal()) return;
  const handle = await chargerHandleDossier();
  if (!handle) return;
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') {
    dossierHandle = handle;
  } else if (surReconnexionRequise) {
    surReconnexionRequise(handle);
  }
}

export async function reactiverDossier(handle) {
  const perm = await handle.requestPermission({ mode: 'readwrite' });
  if (perm === 'granted') dossierHandle = handle;
  return perm === 'granted';
}

export async function ecrireFichierDossier(nomFichier, contenu) {
  if (!dossierHandle) return;
  try {
    const fh = await dossierHandle.getFileHandle(nomFichier, { create: true });
    const w = await fh.createWritable();
    await w.write(contenu);
    await w.close();
  } catch (e) {
    console.warn('Écriture locale automatique échouée pour ' + nomFichier, e);
  }
}
