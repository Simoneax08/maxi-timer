# Maxi Timer

Die Seite wird aus Quellteilen gebaut. **Bearbeite nur `src/`**, die `index.html` im Root entsteht automatisch.

## Struktur

| Ordner | Inhalt |
|---|---|
| `src/head.html` | HTML-Kopf, lädt Supabase |
| `src/css/` | Styles, nach Bereich getrennt (base, games, account-leaderboard, shop-ui, responsive) |
| `src/body/` | Seiten: shell (Topbar/Tabs), timer, market, stats, login, leaderboard, modals |
| `src/js/` | Spiel-Logik, nach Bereich getrennt (core, stats, rewards, cards, crash-plinko, shop, meta, account-supabase) |
| `src/tail.html` | Ende der Seite |
| `scripts/build.mjs` | Baut die `index.html` und prüft die Syntax |
| `.github/workflows/build.yml` | Baut automatisch bei jeder Änderung in `src/` |

## Lokal bauen

    node scripts/build.mjs

Der Build bricht ab, wenn das Spiel-Script einen Syntaxfehler hat.

## Warum ein einziges Script?

Der Spielcode liegt in einer abgeschlossenen Funktion (Konsolen-Schutz). Separate Script-Dateien könnten diese internen Variablen nicht teilen, deshalb werden alle JS-Teile zu einem Script zusammengesetzt.
