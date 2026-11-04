# Dead by Daylight website

Main site: https://deadbydaylight.sic4riodragon.uk/

## Pages
- Homepage: `/`
- Killers: `/killers/` (old `/?k=` links redirect)
- Survivors: `/survivors.html`
- Achievements: `/achievements/` (select tracked players)
- Rulebook: `/dbd-rulebook/`
- Farming guides: https://dbdfarming.sic4riodragon.uk/

The original `killers.json`, `survivors.json`, builds, clips, and images remain editable independently.

## Steam achievements
Achievement syncing runs every three hours via GitHub Actions (minute 17 UTC), and can also be triggered manually. Add the `STEAM_API_KEY` **Actions repository secret**; never put it in a website file. Steam Game Details must be public for achievements to be available.

Go to **Actions → DBD achievements - sync and manage → Run workflow**:
- `sync`: refresh all players.
- `add`: supply a **SteamID64**. Optional display name is used as a fallback until Steam name is fetched.
- `remove`: supply the ID; primary account is protected.
- `rename`: supply the ID and desired override. Leave display name blank to use the current Steam name again.

The registered players are in `achievements/players.json`. A player's `overrideName` takes priority over the Steam name; otherwise the current Steam name is displayed, with `fallbackName` used before the first successful fetch. Player snapshots are kept separately in `achievements/players/STEAMID.json`.

The shared catalog and icons are in `achievements/achievements.base.json` and `achievements/achievements.icons.json`. Missing or unavailable Steam data never intentionally clears the previous snapshot. Steam may not expose the progress counter for an unfinished achievement; existing progress is therefore retained, not fabricated.

**GitHub Pages setup:** In Settings → Pages, select **GitHub Actions** as the build/deployment source for this workflow to deploy updated data automatically. The workflow commits updated snapshots and deploys the site after a successful run. Ensure Actions can write repository contents (Settings → Actions → General). The old branch-based Pages source may not redeploy for commits made by GitHub's default workflow token.

The 3-hour schedule is best-effort: GitHub may delay scheduled jobs. The public player profile shows the actual last successful sync timestamp.

### Testing
Run **sync** manually in GitHub Actions; check for errors, verify the Pages deployment and compare the resulting profile with Steam. If it fails, data from the previous successful synchronization is kept.

The retired alt account/repository is not modified or deleted.

## Site tools and achievement maintenance

- Player comparison: `/achievements/compare/`. Select any two current profiles, filter unlock differences, and share comparison URLs.
- Collection editor: `/tools/collection-editor/`. Update character prestige, builds, clips and notes locally; download or copy the full collection file and commit it. This editor does not save to GitHub by itself.
- Homepage and achievement pages show recent unlocks from Steam timestamps and completion summaries.
- `achievements/catalog-review.json` lists new achievements whose category cannot be identified safely. To review, edit `achievements/achievements.base.json`, update `category` and `section`, and remove `needsReview`. The review file refreshes on each Steam sync.
- The deployment workflow now validates registered player files and achievement catalog IDs with `scripts/validate-data.cjs`.
- Steam unlocks are authoritative. Partial progress may come from older saved values and is labeled as saved rather than live.

## Farming guide links
The tracker uses `achievements/farming-links.json` to link verified guide methods from `dbdfarming.sic4riodragon.uk`. The GitHub Actions sync refreshes this mapping from the companion repository's public `data/achievements.json` and `data/methods.json` files, retaining last valid data on errors. Use **Farmable only** on an individual player's locked achievements; the comparison page offers **Both locked + farming guide** for shared goals.

## Optional Steam playtime
The sync also attempts public DBD playtime from Steam's `IPlayerService/GetOwnedGames` and `GetRecentlyPlayedGames` endpoints. It stores supported total minutes and recent two-week minutes in the player snapshots; visibility restrictions do not erase older known playtime. Escapes, sacrifices, grades, and match history are not guessed from unidentified or unsupported statistic endpoints.
