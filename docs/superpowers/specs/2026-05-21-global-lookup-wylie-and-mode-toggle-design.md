# GlobalLookupWindow — Détection Wylie & toggle Define/Search

## Contexte

Le popup de lookup global (`GlobalLookupWindow.vue`), déclenché par un raccourci clavier system-wide, lit le contenu du presse-papier et choisit entre deux modes :

- `define` — autocomplete sur les termes tibétains (panneau split termes/définitions)
- `search` — full-text search dans les définitions

La détection actuelle ([GlobalLookupWindow.vue:268-269](../../../src/components/GlobalLookupWindow.vue#L268-L269)) est binaire :

```js
const hasTibetan = /[ༀ-࿿]/.test(raw);
this.mode = hasTibetan ? 'define' : 'search';
```

**Problème** : du Wylie copié depuis une source anglaise (ex. `sangs rgyas`) tombe dans la branche "non tibétain" et part en `search`, alors que l'utilisateur veut une définition.

**Ambiguïté fondamentale** : Wylie et anglais utilisent le même alphabet ASCII. De nombreux mots anglais sont aussi des syllabes Wylie syntaxiquement valides (`the` → ཐེ་, `she` → ཤེ་). Une détection 100 % automatique n'est pas atteignable — il faut une heuristique acceptable + un fallback utilisateur.

## Objectif

1. Faire en sorte que du Wylie collé dans le presse-papier déclenche un `define` avec le terme converti, dans les cas où le résultat correspond à un terme connu.
2. Donner à l'utilisateur un moyen visible et rapide de corriger un mauvais choix de mode.

## Design

### Règle de détection automatique (réécrite)

Dans `readClipboardAndSetSearch()` :

```
raw = clipboard.trim()
si raw vide → return

si raw contient un caractère tibétain (U+0F00–U+0FFF) :
  → mode = 'define'
  → searchTerm = cleanTibetanText(raw)

sinon :
  converted = convertWylieInText(raw, { normalizeTrailingPunctuation: true,
                                        normalizeMultipleTshegs: true,
                                        preserveWhitespace: false })
  si converted contient du tibétain
     ET ∃ t ∈ this.allTerms tel que t.startsWith(converted) :
    → mode = 'define'
    → searchTerm = converted
  sinon :
    → mode = 'search'
    → searchTerm = raw
```

Le test `startsWith` sur `allTerms` (déjà en mémoire) est ce qui empêche `compassion`, `the`, etc. de basculer en `define` juste parce qu'ils se convertissent en tibétain syntaxiquement valide. Seuls les Wylie qui correspondent à des termes réels du dictionnaire activent `define`.

Coût : un `.some(startsWith)` sur un tableau JS en mémoire. Pas de I/O, pas d'IPC.

### Composant UI — v-tabs au-dessus de l'input

Insertion d'un `<v-tabs>` Vuetify entre la `drag-bar` et la `search-bar` actuelles :

```
┌─────────────────────────────────────┐
│         drag bar (⋯⋯⋯)              │
├─────────────────────────────────────┤
│  [ Define ]  [ Search ]             │  ← v-tabs (NOUVEAU)
├─────────────────────────────────────┤
│  [input]                      [x]   │
├─────────────────────────────────────┤
│      contenu (split / liste)        │
├─────────────────────────────────────┤
│  Esc close · Tab toggle · ↑↓ nav    │
└─────────────────────────────────────┘
```

Deux tabs : `Define` (icône `mdi-book-open-variant`) et `Search` (icône `mdi-magnify`). `density="compact"`, hauteur réduite pour ne pas alourdir le popup.

### Comportement du toggle manuel

Une méthode unique `setMode(newMode)` qui :

- Si `newMode === this.mode` → no-op.
- **Search → Define** :
  - Si `searchTerm` ne contient aucun caractère tibétain → `searchTerm = convertWylieInText(searchTerm, …)`
  - Sinon laisser tel quel.
- **Define → Search** :
  - Garder `searchTerm` tel quel (le tibétain peut très bien être cherché dans les définitions, et le résultat reste utile).
- Mettre à jour `this.mode`.

Le swap du champ (`TibetanTextField` ↔ `v-text-field`) est déjà géré par les `v-if="mode === 'define'"` / `v-else` existants dans le template.

### Raccourci clavier

`Tab` (sans modificateur) dans `handleKeydown` :
- Bascule entre `define` et `search` via `setMode()`.
- `event.preventDefault()` pour empêcher le focus-shift par défaut.
- Tab fonctionne aussi quand le focus est dans l'input — `keydown` est écouté au niveau `document`, déjà en place pour Esc.

Footer mis à jour : `Esc close · Tab toggle · ↑↓ navigate`.

## Fichier touché

`src/components/GlobalLookupWindow.vue` uniquement.

Changements précis :

1. **Imports** — ajouter `convertWylieInText` depuis `../utils`.
2. **Méthode `readClipboardAndSetSearch()`** (lignes 257-281) — réécrite selon la règle ci-dessus.
3. **Nouvelle méthode `setMode(newMode)`** — gère le toggle manuel + conversion Wylie conditionnelle.
4. **Méthode `handleKeydown(event)`** (lignes 305-319) — ajouter une branche `event.key === 'Tab'`.
5. **Template** — insérer le `<v-tabs>` entre `.drag-bar` et `.search-bar`.
6. **Footer** — ajouter `Tab toggle`.
7. **Styles** — petit override pour que les tabs soient compactes, pas d'effet sur le reste.

Aucun changement Rust, aucun nouveau service, aucune nouvelle dépendance npm.

## Cas limites pris en compte

| Cas                                                          | Résultat                                                                   |
|--------------------------------------------------------------|----------------------------------------------------------------------------|
| Clipboard `སངས་རྒྱས་`                                          | `define`, term = `སངས་`                                                    |
| Clipboard `sangs rgyas` et `སངས་` ∈ allTerms                 | `define`, term = `སངས་རྒྱས་`                                                |
| Clipboard `compassion`                                       | `search`, term = `compassion`                                              |
| Clipboard `the` qui convertit en `ཐེ་` mais n'est pas un terme | `search`, term = `the`                                                     |
| Clipboard vide                                               | no-op                                                                      |
| User en `search`, tape `sangs`, clic sur Define              | passe en `define`, term devient `སངས་`                                     |
| User en `define`, term `སངས་`, clic sur Search               | passe en `search`, term reste `སངས་` (cherché dans les défs)               |
| User appuie sur Tab dans l'input                             | bascule mode, ne change pas le focus DOM                                   |
| Wylie avec apostrophe (`brgya'`)                             | `convertWylieInText` gère déjà — pas de traitement spécial                 |

## Hors-scope explicitement

- Pas de tentative d'améliorer la détection au-delà du test `startsWith(allTerms)`. Les heuristiques plus sophistiquées (longueur, présence de particules grammaticales tibétaines en Wylie, etc.) ajoutent de la complexité pour un gain marginal et peuvent être ajoutées plus tard si nécessaire.
- Pas de mémorisation du dernier mode choisi — chaque ouverture repart sur la détection auto. L'utilisateur n'a pas demandé cette persistance et la détection auto devrait être correcte la plupart du temps.
- Pas de toggle de conversion Wylie en mode `search` (le mode search garde le texte brut, c'est le point du mode search).
- Pas de modification de la `DefinePage` ou `SearchPage` principales — le scope est strictement le popup global.

## Critères de succès

- Coller `sangs rgyas` puis trigger le hotkey → popup ouvre en mode Define avec `སངས་རྒྱས་`.
- Coller `compassion` puis trigger → popup ouvre en mode Search avec `compassion`.
- Coller `སངས་` puis trigger → popup ouvre en mode Define avec `སངས་` (comportement actuel inchangé).
- Cliquer sur le tab Define quand on est en Search avec `sangs` dans l'input → conversion en `སངས་`, mode passe à Define.
- Appuyer sur Tab → bascule entre les deux modes.
- Le popup ne perd pas le focus quand on appuie sur Tab.
