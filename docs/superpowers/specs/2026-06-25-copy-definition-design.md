# Copier une définition — Design

**Date :** 2026-06-25
**Statut :** Validé, prêt pour planification

## Contexte

Sur la page de définition (`DefinePage.vue`), un terme tibétain affiche une liste
d'« entrées », une par dictionnaire qui contient ce terme. Chaque entrée est rendue
par `EntriesEntry.vue` : une puce avec le nom du dictionnaire + le texte de la
définition (HTML décoré par `services/decorator.js`).

Un utilisateur a demandé un bouton pour copier une définition. Le besoin retenu va
au-delà du simple bouton : pouvoir copier **une entrée précise** et **l'ensemble des
définitions d'un terme**, dans un format texte autonome et traçable.

Aujourd'hui aucun bouton de copie n'existe pour les définitions. Le projet utilise
déjà `@tauri-apps/plugin-clipboard-manager` (lecture du presse-papiers dans
`services/global-lookup.js`).

## Objectifs

- Copier une seule entrée (la définition d'un dictionnaire) en un clic.
- Copier toutes les définitions affichées d'un terme en un clic.
- Format texte brut, lisible et collable partout (Notes, mail, messagerie).
- Chaque copie est traçable : on sait de quel terme et de quel dictionnaire elle vient.

## Non-objectifs (YAGNI)

- Pas de copie en texte riche / HTML / Markdown.
- Pas de bouton de copie sur les entrées de dictionnaires scannés (la « définition »
  y est un numéro de page, sans intérêt à copier).
- Pas d'export fichier, pas de partage système, pas de personnalisation du format.

## Décisions

| Sujet | Choix |
| --- | --- |
| Granularité | Bouton par entrée **+** bouton « Tout copier » pour le terme |
| Format | Texte brut propre (HTML retiré) |
| Contenu d'une entrée | `terme (Dico) : définition` — autonome une fois collé |
| Contenu « Tout copier » | Terme en ligne d'en-tête, puis un bloc `(Dico) : définition` par dictionnaire |
| Bouton & feedback | Icône `mdi-content-copy` toujours visible → `mdi-check` ~1,2 s + snackbar « Copié » |
| Entrées scannées | **Aucun** bouton de copie |

## Format copié — exemples

**Une entrée :**

```
བ་ཟློ་ (Tshig mdzod chen mo) : signification de la définition…
```

**Tout copier :**

```
བ་ཟློ་

(Tshig mdzod chen mo) : première définition…

(Dag yig gsar bsgrigs) : seconde définition…
```

Le terme n'est pas répété sur chaque bloc puisqu'il figure en en-tête. Les blocs sont
séparés par une ligne vide. Les entrées de dictionnaires scannés sont exclues du
« Tout copier ».

## Architecture

### Nouveau service : `src/services/copy-service.js`

Service pur, sans dépendance Vue, testable isolément. Responsabilités :

- `stripHtml(html)` → texte propre. Implémentation : un élément DOM temporaire dont on
  lit `textContent` (gère liens, balises et entités HTML proprement).
- `cleanDictionaryLabel(dictionaryName)` → lit `DICTIONARIES_DETAILS` et renvoie
  `shortLabel || label || name` **en texte brut**. On n'utilise pas
  `DictionariesDetailsMixin.dictionaryLabelFor`, qui produit du HTML (spans tibétains) :
  on part de la donnée brute pour rester découplé de Vue et éviter un strip superflu.
- `entryToText(entry)` → `` `${entry.term} (${cleanDictionaryLabel(entry.dictionary)}) : ${stripHtml(entry.definition)}` ``.
- `entriesToText(term, entries)` → en-tête `term`, ligne vide, puis un bloc
  `` `(${cleanDictionaryLabel(e.dictionary)}) : ${stripHtml(e.definition)}` `` par entrée,
  blocs joints par `\n\n`. Les entrées scannées sont déjà filtrées en amont (le bouton
  n'envoie que les entrées non scannées).
- `writeToClipboard(text)` → écriture presse-papiers selon la plateforme, calquée sur
  `global-lookup.js` :
  - Tauri : `const { writeText } = await import('@tauri-apps/plugin-clipboard-manager'); await writeText(text);`
  - Web : `await navigator.clipboard.writeText(text);`
  - Détection de plateforme via `src/config/platform.js` (même mécanisme que le reste du code).
  - Renvoie une promesse ; rejette en cas d'échec pour permettre un retour d'erreur.

### Détection « entrée scannée »

La logique existe déjà dans `EntriesEntry.vue` via `getScanInfo(entry.dictionary)`
(`services/scan-service.js`) → propriété calculée `isScannedDictionary`. On réutilise
`getScanInfo` pour :
- masquer le bouton de copie par entrée (`v-if="!isScannedDictionary"`),
- filtrer les entrées scannées avant `entriesToText` côté `DefinePage`.

## Composants touchés

### `EntriesEntry.vue`

- Template : dans `.entry-header`, à côté de la puce du dictionnaire, ajouter un
  `v-btn` icône (`variant="text"`, `size="small"`) affiché uniquement si
  `!isScannedDictionary`. Icône `copied ? 'mdi-check' : 'mdi-content-copy'`.
- Données : `copied: false` (+ un timer pour le reset).
- Méthode `copyEntry()` :
  1. `await copyService.writeToClipboard(copyService.entryToText(this.entry))`
  2. succès → `this.copied = true`, `this.snackbar.open('Copié')`, reset `copied`
     après ~1200 ms (timer nettoyé dans `beforeUnmount`).
  3. échec → `this.snackbar.open('Échec de la copie')`.
- La snackbar est déjà injectée (`inject: ['snackbar']`).

### `DefinePage.vue`

- Ajouter une fine barre d'en-tête en haut de `.definitions-container`, affichée
  seulement quand `entriesForEnabledDictionaries.length`. Elle contient le terme
  sélectionné (contexte aujourd'hui absent de ce panneau) et un bouton « Tout copier ».
- Méthode `copyAll()` :
  1. filtrer les entrées non scannées via `getScanInfo`,
  2. `await copyService.writeToClipboard(copyService.entriesToText(this.selectedTerm, nonScannedEntries))`,
  3. snackbar « Copié » / « Échec de la copie ».
- La snackbar est disponible au niveau de l'app (provide global) ; vérifier l'accès
  dans `DefinePage` (sinon l'injecter comme dans `EntriesEntry`).

## Flux de données

```
clic icône (EntriesEntry) ──> copyService.entryToText(entry) ──> writeToClipboard ──> snackbar
clic « Tout copier » (DefinePage) ──> filtre non-scannées ──> copyService.entriesToText(term, entries) ──> writeToClipboard ──> snackbar
```

`copy-service` est la seule frontière vers le presse-papiers et le seul responsable du
formatage. Les composants ne font qu'orchestrer l'appel et le retour visuel.

## Gestion des erreurs

- Échec d'écriture presse-papiers (ex. permission web refusée, contexte non sécurisé) :
  capturé et signalé par snackbar « Échec de la copie ». Jamais d'exception non gérée.
- Définition vide / nulle : `stripHtml('')` → `''`, l'entrée copiée se réduit à
  `terme (Dico) : `. Cas marginal, toléré.

## Tests

Tests unitaires Vitest sur `copy-service` (cohérent avec les tests services existants
dans `tests/`) :

- `stripHtml` retire balises et liens, conserve le texte et décode les entités.
- `cleanDictionaryLabel` renvoie `shortLabel`, sinon `label`, sinon le nom brut ;
  jamais de HTML.
- `entryToText` produit `terme (Dico) : déf`.
- `entriesToText` produit l'en-tête du terme + un bloc par entrée, séparés par une
  ligne vide.
- `writeToClipboard` (chemin web) appelle `navigator.clipboard.writeText` avec le bon
  texte (`navigator.clipboard` mocké) et propage l'échec.

Les interactions composant (changement d'icône, snackbar) ne sont pas couvertes par
des tests automatisés, en cohérence avec l'approche service-centrée du dépôt.

## Fichiers

| Fichier | Changement |
| --- | --- |
| `src/services/copy-service.js` | **Nouveau** — formatage + écriture presse-papiers |
| `src/components/EntriesEntry.vue` | Bouton copier par entrée (masqué si scanné) |
| `src/components/DefinePage.vue` | Barre d'en-tête + bouton « Tout copier » |
| `tests/copy-service.test.js` | **Nouveau** — tests unitaires du service |
