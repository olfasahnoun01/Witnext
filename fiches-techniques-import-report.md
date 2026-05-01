# Rapport import fiches techniques

- Date: 2026-05-01T00:53:00.430Z
- Mode: DRY-RUN
- Dossiers appariés: 0
- Dossiers sans correspondance DB (score < 0.72): 37

## Base Supabase inaccessible en lecture (0 groupe, 0 produit)

La clé **anon** (`VITE_SUPABASE_PUBLISHABLE_KEY`) ne renvoie aucune ligne : les politiques RLS exigent une session authentifiée (ou la **service role**).

1. Ajoutez dans `.env.local` : `SUPABASE_SERVICE_ROLE_KEY=...` (Dashboard Supabase → Settings → API).
2. Relancez `node scripts/import-fiches-techniques.mjs` pour prévisualiser les paires dossier ↔ article.
3. Puis `node scripts/import-fiches-techniques.mjs --apply` pour uploader les fichiers dans le bucket `fiches-techniques` et mettre à jour `products.fiche_technique_url`.

---

## Fichiers dans `_unlinked` (non classés par nom d’article) : **101**

## Dossiers locaux (noms = libellés exportés, hors `_unlinked`)

- **BOUCHONS LAVABLES 1271** — 1 fichier(s)
- **CASQUE ANTI BRUIT H510A** — 1 fichier(s)
- **CASQUE ANTICHOC 5RS** — 4 fichier(s)
- **CASQUE DE SECURITE BLANC CLIMAX 5-RS** — 1 fichier(s)
- **CATU-AM 346** — 1 fichier(s)
- **CHAUSSURE DE SECURITE FLEX BELOTTA S3 TIGE BASSE ESD** — 3 fichier(s)
- **DEMI MASQUE 2000T MPL** — 4 fichier(s)
- **DEMI MASQUE 2000TMPL** — 4 fichier(s)
- **DEMI MASQUE IN AIR 1000T** — 1 fichier(s)
- **DIVISION DN65_2x40 EN ALU A A VOLANT** — 1 fichier(s)
- **DIVISION DN65_2x40 EN ALU AA LEVIER** — 1 fichier(s)
- **EXTINC CO2-05 KG** — 1 fichier(s)
- **EXTINC POUDRE ABC PA -06KG** — 1 fichier(s)
- **EXTINC POUDRE ABC PA-09 KG** — 1 fichier(s)
- **EXTINCTEUR A POUDRE 9KG PRES AUXILIAIRE** — 4 fichier(s)
- **Extincteur CO2 de 02KG CE** — 1 fichier(s)
- **Extincteur CO2 de 05 KG CE** — 3 fichier(s)
- **Extincteur CO2 de 10 KG sur chariot** — 3 fichier(s)
- **Extincteur a eau pulverisee AV ADDITIF de 50L** — 1 fichier(s)
- **FLEXIBLE POUR EXTINC POUDRE PP -09 KG** — 1 fichier(s)
- **Filtre B204 ABEK2 MPL pour demi masque 1000T_2000T** — 4 fichier(s)
- **GANT POLYAMIDE PLOMO** — 1 fichier(s)
- **GANT PRODUIT CHMIQUES** — 1 fichier(s)
- **Gant anti- coupures Niveau C Rhinoflex 08** — 1 fichier(s)
- **Harnais anti chute ATLAS** — 3 fichier(s)
- **Kit harnais RF 27 Climax** — 3 fichier(s)
- **Lunette de protection S-400 CLASSIC Baymax avec** — 1 fichier(s)
- **MASQUE FFP2 AVEC SOUPAPE** — 1 fichier(s)
- **MASQUE FFP3 AVEC VALVE M1305V DELTA PLUS** — 1 fichier(s)
- **MASQUE FFP3 AVEC VALVE SERIE S MFA** — 5 fichier(s)
- **Masque intégrale elipse avec filtres ABEK1P3** — 1 fichier(s)
- **Masque respiratoire ELLIPSE A1P3** — 1 fichier(s)
- **PAIRE DE GANT NITRILE SINGLE COAT SAFETOP G148** — 1 fichier(s)
- **PAIRES DE BOUCHON D.OREILLES AVEC CORDON SNR37 DB** — 3 fichier(s)
- **Paire de gant isolant 500V SG-25-T10_CLASSE 00 Sofamel** — 1 fichier(s)
- **TUYAU SEMI REGIDE DN-33_30ML** — 1 fichier(s)
- **TUYAU SEMI RIGIDE POUR RIA DN33_30 AV ACCESSOIR** — 1 fichier(s)

## Dossiers locaux non appariés (pas de produit / groupe assez proche)

- **BOUCHONS LAVABLES 1271** (1 fichier(s)) — meilleur score: 0.00 (—)
- **CASQUE ANTI BRUIT H510A** (1 fichier(s)) — meilleur score: 0.00 (—)
- **CASQUE ANTICHOC 5RS** (4 fichier(s)) — meilleur score: 0.00 (—)
- **CASQUE DE SECURITE BLANC CLIMAX 5-RS** (1 fichier(s)) — meilleur score: 0.00 (—)
- **CATU-AM 346** (1 fichier(s)) — meilleur score: 0.00 (—)
- **CHAUSSURE DE SECURITE FLEX BELOTTA S3 TIGE BASSE ESD** (3 fichier(s)) — meilleur score: 0.00 (—)
- **DEMI MASQUE 2000T MPL** (4 fichier(s)) — meilleur score: 0.00 (—)
- **DEMI MASQUE 2000TMPL** (4 fichier(s)) — meilleur score: 0.00 (—)
- **DEMI MASQUE IN AIR 1000T** (1 fichier(s)) — meilleur score: 0.00 (—)
- **DIVISION DN65_2x40 EN ALU A A VOLANT** (1 fichier(s)) — meilleur score: 0.00 (—)
- **DIVISION DN65_2x40 EN ALU AA LEVIER** (1 fichier(s)) — meilleur score: 0.00 (—)
- **EXTINC CO2-05 KG** (1 fichier(s)) — meilleur score: 0.00 (—)
- **EXTINC POUDRE ABC PA -06KG** (1 fichier(s)) — meilleur score: 0.00 (—)
- **EXTINC POUDRE ABC PA-09 KG** (1 fichier(s)) — meilleur score: 0.00 (—)
- **Extincteur a eau pulverisee AV ADDITIF de 50L** (1 fichier(s)) — meilleur score: 0.00 (—)
- **EXTINCTEUR A POUDRE 9KG PRES AUXILIAIRE** (4 fichier(s)) — meilleur score: 0.00 (—)
- **Extincteur CO2 de 02KG CE** (1 fichier(s)) — meilleur score: 0.00 (—)
- **Extincteur CO2 de 05 KG CE** (3 fichier(s)) — meilleur score: 0.00 (—)
- **Extincteur CO2 de 10 KG sur chariot** (3 fichier(s)) — meilleur score: 0.00 (—)
- **Filtre B204 ABEK2 MPL pour demi masque 1000T_2000T** (4 fichier(s)) — meilleur score: 0.00 (—)
- **FLEXIBLE POUR EXTINC POUDRE PP -09 KG** (1 fichier(s)) — meilleur score: 0.00 (—)
- **Gant anti- coupures Niveau C Rhinoflex 08** (1 fichier(s)) — meilleur score: 0.00 (—)
- **GANT POLYAMIDE PLOMO** (1 fichier(s)) — meilleur score: 0.00 (—)
- **GANT PRODUIT CHMIQUES** (1 fichier(s)) — meilleur score: 0.00 (—)
- **Harnais anti chute ATLAS** (3 fichier(s)) — meilleur score: 0.00 (—)
- **Kit harnais RF 27 Climax** (3 fichier(s)) — meilleur score: 0.00 (—)
- **Lunette de protection S-400 CLASSIC Baymax avec** (1 fichier(s)) — meilleur score: 0.00 (—)
- **MASQUE FFP2 AVEC SOUPAPE** (1 fichier(s)) — meilleur score: 0.00 (—)
- **MASQUE FFP3 AVEC VALVE M1305V DELTA PLUS** (1 fichier(s)) — meilleur score: 0.00 (—)
- **MASQUE FFP3 AVEC VALVE SERIE S MFA** (5 fichier(s)) — meilleur score: 0.00 (—)
- **Masque intégrale elipse avec filtres ABEK1P3** (1 fichier(s)) — meilleur score: 0.00 (—)
- **Masque respiratoire ELLIPSE A1P3** (1 fichier(s)) — meilleur score: 0.00 (—)
- **Paire de gant isolant 500V SG-25-T10_CLASSE 00 Sofamel** (1 fichier(s)) — meilleur score: 0.00 (—)
- **PAIRE DE GANT NITRILE SINGLE COAT SAFETOP G148** (1 fichier(s)) — meilleur score: 0.00 (—)
- **PAIRES DE BOUCHON D.OREILLES AVEC CORDON SNR37 DB** (3 fichier(s)) — meilleur score: 0.00 (—)
- **TUYAU SEMI REGIDE DN-33_30ML** (1 fichier(s)) — meilleur score: 0.00 (—)
- **TUYAU SEMI RIGIDE POUR RIA DN33_30 AV ACCESSOIR** (1 fichier(s)) — meilleur score: 0.00 (—)

## Articles (variants) sans fiche — non couverts par un dossier apparié

_Impossible de lister les articles tant que la base n’est pas lisible (voir section « Base Supabase inaccessible » ci-dessus)._
