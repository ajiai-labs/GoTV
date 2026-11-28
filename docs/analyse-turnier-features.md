# Turnier- und Zuschauer-Features – Ideensammlung (28.11.2026)

Herkunft: Ideen-Katalog eines zweiten Modells (GPT-OSS 120B) auf die Frage „Was könnte man in
GoTV noch einbauen, turniermäßig?“. Hier abgelegt mit einer Bewertung gegen die Regeln und den
Stand von GoTV (AGENTS.md). **Entscheidung des Nutzers (28.11.2026): jetzt nur das
Zuschauererlebnis verbessern**; der Rest bleibt hier als Sammlung, ohne Auftrag.

Feste Grenzen, an denen viele Vorschläge scheitern:

- **Kein eigener Server** (Nutzer, 24.11.2026): keine Datenbank im Netz, keine Push-Nachrichten
  bei geschlossener App, kein REST-/GraphQL-Dienst.
- **GoTV ist ein KGS-Client, kein Turnierausrichter:** Paarungen, Runden und Ergebnisse von
  KGS-Turnieren macht der KGS-Turnierleiter; die JSON-Schnittstelle bietet dafür nichts für
  normale Konten (nur `tournOnly`-Räume, Partietyp `tournament`, Spielerkennzeichen TT/t/P).
- **OGS nur als Quelle für Übertragungen** (24.11.2026), kein Spielen dort.
- **Keine KI bei laufenden Partien** (24.11.2026) – auch keine „Analyse-Overlays“.
- **KGS-Verbindung ist oberste Priorität:** nichts, was vielen Partien auf einmal beitritt.

## Zuschauererlebnis – jetziger Schwerpunkt

| Vorschlag (Katalog) | Bewertung | Stand / Weg in GoTV |
|---|---|---|
| Mehr-Brett-Ansicht mit Mini-Vorschau, Zug, Uhr, Ergebnis | **Gut, Kern des Schwerpunkts.** | Brettübersicht (bis 6 Bretter) und `BoardPreviewGrid` (Übertragungen) gibt es; die Kacheln zeigen noch keine Uhren und nicht, wer am Zug ist. Eine Vorschau braucht den Beitritt zur Partie (die Partieliste hat keine Stellung) – also nur auf Klick und begrenzt, über das vorhandene eine Abo pro Partie (`onViewGame`). |
| Zeit-Overlay (Restzeit, Byo-Yomi) im Partiefenster | Gut, teils erledigt. | Uhr seit 28.11.2026 größer, im Byo-Yomi rot. Für Kacheln der Brettübersicht noch offen. |
| „Replay-Modus“ während das Spiel läuft (zurückspulen, ohne KGS zu stören) | Erledigt. | Blättern im Partiefenster ist lokal; „Lokal betrachten“ kopiert die Partie ins Nachspielen (ohne KataGo, solange sie läuft). |
| Eingebettete Streams pro Partie | Teilweise erledigt. | Stream neben dem Brett über Kalender (`kgs_room`/`kgs_players`/`ogs_*`). Streams automatisch per YouTube-API finden braucht einen Server-Schlüssel – nicht ohne Server. |
| Statistik-Heatmap über laufende Partien | Eher nicht. | Ohne KI erlaubt, aber für Zuschauer wenig aussagekräftig; braucht die Stellungen vieler Partien (Beitritte). |
| Erinnerungen bei Spielbeginn / Ergebnis | Teilweise erledigt. | Browser-Benachrichtigung für gefolgte Spieler und Favoriten, solange GoTV offen ist. Bei geschlossener App: braucht Server. |
| Live-Bracket (Turnierbaum) | Nur für externe Turniere mit Daten. | KGS liefert keine Turnierbäume. Für Speed-Go o. Ä. ginge es aus den Importen (Begegnungen mit Partien) – eigener Auftrag. |
| QR-Code für den Link einer Übertragung / Partie | Klein, möglich. | Für Vereinsabende am Beamer; braucht eine kleine Bibliothek. |
| Turnier-Themes (Farben/Logos je Veranstaltung) | Eher nicht. | Branding fremder Veranstalter – heikel (keine Logos ohne Erlaubnis). |

## Turnierbetrieb – zurückgestellt

| Vorschlag | Bewertung |
|---|---|
| Automatischer Turnier-Scheduler (Schweizer System, Round Robin) mit Admin-Oberfläche | Nicht machbar ohne Server und ohne KGS-Turnierleiter-Rechte. |
| Turnier-Chat je Turnierraum | Gibt es: KGS-Raumchat. Turnierräume eigens kennzeichnen (`tournOnly`) wäre klein. |
| Push-Benachrichtigung „Dein Match beginnt in 5 Minuten“ | KGS meldet eigene Turnierpartien (`TOURN_NOTIFY`); ein Hinweis/Ton in GoTV bei offener App wäre klein. Echte Push bei geschlossener App: Server nötig. |
| Turnier-Archiv als ZIP (alle SGF, Tabellen) | **Gebaut 28.11.2026 für Kalender-Turniere mit OGS-Partien** („Alle N Partien herunterladen (ZIP)“ unter der Partieliste). KGS-interne Turniere bewusst außen vor (Nutzer). Ursprüngliche Einschätzung: Machbar für Kalender-Turniere mit OGS-Partien (`ogs_game_ids`/`ogs_players`): OGS liefert das SGF beendeter Partien anonym und mit CORS; ZIP ohne Kompression lässt sich ohne neue Abhängigkeit schreiben (etwa 2 Stunden). KGS-Turniere: files.gokgs.com sendet kein CORS, und die Teilnehmerliste liefert KGS nicht – nur über den Desktop-Proxy und die in „Jetzt auf KGS“ gesehenen Partien, eigener größerer Auftrag. |
| Turnier-Ranking / Elo-Tabelle | Nur mit Ergebnisdaten des Veranstalters; KGS liefert keine Turniertabellen. |
| Team-Modus mit Team-Wertung | Brettübersicht für Mannschaftskämpfe gibt es; eine Wertung bräuchte Ergebnisse aller Bretter – denkbar lokal, aber kein Auftrag. |
| Turnier-Import/Export (CSV/ICS) | ICS-Export des Kalenders wäre klein und nützlich; Import nicht nötig (events.json). |
| Rollen- und Rechtesystem | Gehört zu KGS (Raumbesitzer, Admins), nicht zu GoTV. |

## Server und Schnittstellen – nicht machbar / nicht gewollt

| Vorschlag | Bewertung |
|---|---|
| OGS-/eigener-Server-Rückfall, wenn KGS ausfällt | Widerspricht „OGS nur Übertragungen“; ein eigener Go-Server ist ausgeschlossen. |
| REST-/GraphQL-API für Turnierdaten | Braucht einen Server. events.json auf GitHub ist bereits offen lesbar. |
| KGS-Ereignisse über einen WebSocket-Proxy | Bringt nichts: KGS spricht nur Long-Polling; der lokale Proxy reicht die Antworten schon sofort durch. |

## Aufwand der kleinen Punkte (Schätzung)

- Kacheln der Brettübersicht mit Uhren und „X am Zug“: etwa 1–2 Stunden.
- Hinweis/Ton bei `TOURN_NOTIFY` (eigene Turnierpartie beginnt): etwa 1 Stunde.
- Turnierräume in der Raumliste kennzeichnen: etwa 30 Minuten.
- ICS-Export eines Kalendertermins: etwa 1 Stunde.
- QR-Code für Übertragungslinks: etwa 1 Stunde (neue Abhängigkeit – vorher fragen).

## Datenquellen für Übertragungen (geprüft 28.11.2026)

Wunsch des Nutzers: internationale und Städteturniere **übertragen mit Brett und Video**, ohne sich
auf anderen Servern anzumelden. Ein zweites Modell (GPT-OSS 120B) nannte dazu Quellen; jede Adresse
wurde mit einem einzelnen Abruf geprüft – fast alle sind erfunden:

| Genannte Quelle | Prüfung |
|---|---|
| KGS `https://www.gokgs.com/json/tournaments` | 404 – gibt es nicht |
| EGF `https://www.eurogofed.org/egf/tournaments.json` | 403 – gibt es nicht |
| AGA `https://www.usgo.org/tournaments.json` | 404 – gibt es nicht |
| go4net.org, pandanet-igg.com, europeangodirectory.org | Domains existieren nicht |
| `https://www.intergo.com/api/events` („IGF“) | geparkte Werbeseite |
| `https://gobase.org/api/tournaments` | leitet auf eine fremde Artikelseite um |
| OGS `https://online-go.com/api/v1/tournaments/` | echt, aber OGS-interne Online-Turniere (61 763) – wie KGS-interne Turniere nicht gewollt |

Schon in GoTV (tools/update_events.py, täglich per GitHub Actions): Twitch-Sendeplan der EGF
(iCalendar ohne Schlüssel), DGoB-Turnierkalender (WordPress-API), EGF-Grand-Prix-Kalender (HTML),
Speed-Go-Turnierseite (Begegnungen + OGS-Partien); Bretter über `ogs_game_ids`/`ogs_players` und
KGS (`kgs_room`/`kgs_players`).

Echte, noch ungenutzte Quellen:

| Quelle | Was sie bringt | Weg | Einschränkung |
|---|---|---|---|
| YouTube-Kanal-RSS `youtube.com/feeds/videos.xml?channel_id=UC…` (**gebaut 28.11.2026**: „Neue Videos der Kanäle“) | die letzten 15 Videos eines Kanals mit Titel und Datum (EGF: Deutsche Meisterschaft Runde 1–7, Pandanet-Mannschafts-EM) | täglicher Import (Python, kein Schlüssel) → Aufzeichnungen zu Kanälen/Turnieren | kein CORS (nicht direkt aus der Web-Version); angekündigte Livestreams stehen im Feed (geprüft: Nongshim-Cup-Übertragung bei Nihon Ki-in), aber ohne Startzeit |
| Twitch-Sendeplan anderer Kanäle (gleicher iCalendar-Weg wie EGF; **gebaut 28.11.2026**, AGA und Yunguseng – Sendepläne derzeit leer) | geplante Sendungen von AGA, Yunguseng Dojang … | `update_events.py` für alle Twitch-Kanäle in `channels[]` | nur Kanäle, die einen Twitch-Sendeplan pflegen |
| European Go Database (europeangodatabase.eu) | Ergebnisse vergangener europäischer Turniere | Link „Ergebnisse“ an Archiv-Einträgen | erst nach dem Turnier, kein Live |
| Pandanet/IGS | Pandanet Go European Team Championship läuft dort | – | blockiert, bis die IGS-Nutzungsbedingungen geklärt sind |
| Fox Weiqi | Partien von FJ Dickhut u. a. | – | keine offene Schnittstelle (Nutzer wartet auf Antwort von Fox) |
