/**
 * config.js — Constantes globales de l'application.
 * Modifier ici les informations de la société, les clés de stockage
 * et les réglages par défaut. Aucun autre module ne doit contenir
 * de valeur "en dur" concernant la société ou le stockage.
 */

export const SOCIETE = {
  nom: "Friterie de L'Ancienne Gare",
  adresse1: "Rue du Tiernes à Tartes 134",
  adresse2: "7100 La Louvière",
  tva: "BE0803867605"
};

// Mot de passe d'accès à l'écran "Gestion des prix"
export const MDP_GESTION = "1452";

// Clés utilisées dans le stockage local du navigateur (localStorage)
export const CLES_STOCKAGE = {
  CATALOGUE: "catalogue_v22",
  VENTES: "ventes_v22",
  BLOC_TICKETS: "bloc_tickets_v22",
  BLOC_TICKETS_ATTENTE: "bloc_tickets_attente_v22",
  COMPTEUR_SECOURS: "compteur_secours_v22",
  CLOTURES: "clotures_v22",
  FILE_SYNC: "file_sync_v22",
  GITHUB_CONFIG: "github_config_v22",
  IDENTIFIANT_CAISSE: "identifiant_caisse_v22"
};

// Nombre de numéros de ticket réservés en une fois par un appareil
// auprès du dépôt privé. Volontairement large : à ce rythme, un
// appareil ne devrait quasiment jamais épuiser son bloc alors qu'il
// est hors-ligne (voir numerotation.js pour le filet de sécurité si
// cela arrive tout de même).
export const TAILLE_BLOC_TICKETS = 100;

// Largeur (en caractères) des tickets et clôtures imprimés en texte
export const LARGEUR_TICKET = 42;

// Taux de TVA belges disponibles pour les articles
export const TAUX_TVA_DISPONIBLES = [6, 12, 21];

// Emplacement du catalogue par défaut (servi comme fichier statique)
export const CHEMIN_CATALOGUE_JSON = "./data/catalogue.json";
