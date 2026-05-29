import { round3 } from './money';

const UNITS = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf',
];

function under100(n: number): string {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    const base = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'][ten];
    if (unit === 0) return base;
    if (unit === 1 && ten !== 8) return `${base} et un`;
    return `${base}-${UNITS[unit]}`;
  }
  if (n < 80) {
    const unit = n - 60;
    return unit === 11 ? 'soixante et onze' : `soixante-${UNITS[unit]}`;
  }
  if (n < 100) {
    const unit = n - 80;
    if (unit === 0) return 'quatre-vingts';
    return unit === 1 ? 'quatre-vingt-un' : `quatre-vingt-${UNITS[unit]}`;
  }
  return String(n);
}

function under1000(n: number): string {
  if (n < 100) return under100(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const hundredWord = hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent`;
  if (rest === 0) return hundreds > 1 ? `${hundredWord}s` : hundredWord;
  const cent =
    hundreds === 1 ? 'cent' : hundreds > 1 && rest === 0 ? `${UNITS[hundreds]} cents` : `${UNITS[hundreds]}-cent`;
  return rest === 0 ? cent : `${hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent`}-${under100(rest)}`;
}

function under1_000_000(n: number): string {
  if (n < 1000) return under1000(n);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const thousandWord = thousands === 1 ? 'mille' : `${under1000(thousands)} mille`;
  if (rest === 0) return thousandWord;
  return `${thousandWord} ${under1000(rest)}`;
}

function integerToFrench(n: number): string {
  if (n === 0) return 'zéro';
  if (n < 0) return `moins ${integerToFrench(-n)}`;
  if (n < 1_000_000) return under1_000_000(n);
  if (n < 1_000_000_000) {
    const millions = Math.floor(n / 1_000_000);
    const rest = n % 1_000_000;
    const millionWord = millions === 1 ? 'un million' : `${integerToFrench(millions)} millions`;
    return rest === 0 ? millionWord : `${millionWord} ${integerToFrench(rest)}`;
  }
  return n.toLocaleString('fr-FR');
}

/**
 * Montant TND en toutes lettres (dinars + millimes) — art. 272 Code de commerce.
 * Ex. 5430.567 → « cinq mille quatre cent trente dinars et cinq cent soixante-sept millimes »
 */
export function montantEnLettresDt(montant: number): string {
  const safe = round3(Math.abs(montant));
  const dinars = Math.floor(safe);
  const millimes = Math.round((safe - dinars) * 1000);

  const dinarLabel = dinars <= 1 ? 'dinar' : 'dinars';
  let text = `${integerToFrench(dinars)} ${dinarLabel}`;

  if (millimes > 0) {
    const millimeLabel = millimes <= 1 ? 'millime' : 'millimes';
    text += ` et ${integerToFrench(millimes)} ${millimeLabel}`;
  }

  return montant < 0 ? `moins ${text}` : text;
}

/** Première lettre en majuscule pour l'impression officielle. */
export function montantEnLettresDtCapitalized(montant: number): string {
  const s = montantEnLettresDt(montant);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
