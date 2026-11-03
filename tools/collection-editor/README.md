# Collection editor

Open https://deadbydaylight.sic4riodragon.uk/tools/collection-editor/ to update killers or survivors in a browser.

It is intentionally **local-only**. Changes to data are not sent to GitHub, and there is no server-side admin login. You can edit several characters in a single session, download the complete updated `killers.json` or `survivors.json`, then replace the respective file in the GitHub repository and commit.

The editor retains existing images, non-edited fields, and all other character records. Per-character fields: prestige (0-100), owned/main/rotation, card-name visibility, favorite perks, add-ons/items, offering, notes, and clips.

Be aware that switching away from the page without exporting will lose browser-only edits. Save character first and export the appropriate file. GitHub Pages should deploy the new JSON after committing.
