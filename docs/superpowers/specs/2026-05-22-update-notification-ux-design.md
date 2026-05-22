# Notification de mise à jour persistante

## Contexte

L'app desktop (Tauri) télécharge et installe les mises à jour silencieusement au
démarrage ([App.vue:227](../../../src/components/App.vue#L227) →
[update-service.js](../../../src/services/update-service.js)). Quand l'update est
prête, un snackbar éphémère annonce qu'il faut redémarrer. Le problème : si
l'utilisateur loupe ce snackbar (il disparaît en quelques secondes), il ne sait
jamais qu'une mise à jour attend, et continue de tourner sur l'ancienne version.

La page Settings expose un bouton "Check for Updates"
([ConfigurePage.vue:375](../../../src/components/ConfigurePage.vue#L375)) mais
rien n'indique qu'une update est déjà téléchargée et prête.

## Objectif

Rendre l'état "mise à jour prête, redémarrage requis" visible en permanence,
sur tous les écrans, jusqu'à ce que l'utilisateur redémarre — sans être
intrusif.

## Décisions de design (validées avec l'utilisateur)

- **Indicateur permanent** : pastille rouge sur l'onglet Settings (pattern type
  Chrome : l'icône de menu signale discrètement la MAJ). Visible partout, ne
  prend pas de place.
- **Page Settings** : le bouton "Check for Updates" devient "Restart to update"
  (coloré) quand une update est prête.
- **Redémarrage** : confirmation via dialogue avant relaunch (évite un
  redémarrage accidentel en pleine recherche).
- **Snackbar de démarrage** : conservé tel quel ; le badge prend le relais
  comme rappel permanent.

## Architecture

### État réactif partagé — `update-service.js`

Aujourd'hui `updateReady` / `downloadProgress` sont des propriétés non-réactives
de l'instance `UpdateService`. On introduit un objet `reactive()` (même pattern
que `pack-manager.js`) porté par l'instance :

```js
this.state = reactive({
  updateReady: false,
  version: null,         // ex: "1.8.0"
  downloading: false,
  downloadProgress: 0,   // 0–100
});
```

`checkAndDownload()` met à jour ce state :
- `downloading = true` avant le téléchargement
- `downloadProgress` mis à jour pendant (en accumulant les `chunkLength` sur
  `contentLength` — le code actuel divisait un chunk isolé par le total, ce qui
  ne donnait jamais une vraie progression ; corrigé puisqu'on s'en sert
  désormais pour l'affichage "Downloading NN%")
- `downloading = false`, `updateReady = true`, `version = update.version` à la fin

Les composants accèdent à `UpdateService.state` (proxy réactif) en computed.

### Badge — `App.vue`

- Computed `updateReady()` → `UpdateService.state.updateReady`.
- Dans la boucle des tabs, pour `tab.id === 'settings'` et `updateReady`, le
  contenu de l'onglet est enveloppé dans un `<v-badge dot color="error">` :
  - Desktop : `inline`, point rouge après le texte "Settings".
  - Mobile : badge par défaut (coin haut-droit) autour de l'icône `mdi-cog`.
- Sans update, le rendu actuel est inchangé.

### Carte About — `ConfigurePage.vue`

Computed lisant `UpdateService.state` : `updateReady`, `updateVersion`,
`updateDownloading`, `updateProgress`.

Le bloc bouton de la carte About devient conditionnel :

| État | Affichage |
|------|-----------|
| MAJ prête | `v{appVersion} → v{updateVersion} ready` + `[ ⟳ Restart to update ]` (color primary) |
| Téléchargement en cours | `[ Downloading… {progress}% ]` (loading/disabled) |
| Sinon | `[ Check for Updates ]` (comportement actuel) |

Nouveau `v-dialog` de confirmation : *"Restart now to apply the update?"* avec
**Cancel** / **Restart**. Le bouton Restart appelle
`UpdateService.installAndRelaunch()`.

Data ajoutée : `restartDialog: false`. Méthodes : `openRestartDialog()`,
`confirmRestart()`.

## Fichiers touchés

- `src/services/update-service.js` — état réactif + accumulation de la progression
- `src/components/App.vue` — badge sur l'onglet Settings
- `src/components/ConfigurePage.vue` — bouton conditionnel + dialogue de confirmation

Aucun changement Rust, aucune nouvelle dépendance.

## Cas limites

| Cas | Comportement |
|-----|--------------|
| Pas d'update | Aucun badge, bouton "Check for Updates" normal |
| Update auto au démarrage prête | Snackbar (1×) + badge rouge persistant + bouton "Restart to update" |
| Check manuel depuis Settings | Bouton passe à "Downloading…", puis "Restart to update" + badge apparaît |
| Web / mobile | `UpdateService` court-circuite (isTauri/isMobile) → `updateReady` reste false, pas de badge. La carte About est déjà `v-if="appVersion"` (Tauri only). |
| Clic Restart puis Cancel | Dialogue se ferme, rien ne se passe, badge reste |
| Échec du téléchargement | `downloading = false`, `updateReady` reste false, pas de badge |

## Hors-scope

- Pas de changement à la cadence de vérification (toujours au démarrage).
- Pas de re-téléchargement manuel ni de gestion de versions multiples.
- Pas de persistance de l'état entre sessions : un redémarrage applique l'update,
  donc l'état "prête" n'a pas à survivre à un relaunch.
- Pas de badge sur les autres onglets ni de système de notification générique.

## Critères de succès

- Après qu'une update se télécharge, une pastille rouge apparaît sur l'onglet
  Settings et y reste sur tous les écrans.
- La carte About affiche "v… → v… ready" et un bouton "Restart to update".
- Cliquer dessus ouvre une confirmation ; confirmer relance l'app sur la
  nouvelle version.
- Aucun badge ni bouton de restart quand il n'y a pas d'update.
