# Gray Area — Gray Zone Warfare Tools

**Website:** https://gwazyjustcause.github.io/GrayArea/

The site focuses on these practical tools:

- **[Money](https://gwazyjustcause.github.io/GrayArea/money.html)** — interactive rectangular item fitting in backpack and plate carrier grids, weapon sling positions, resale estimates, and TAKE / SWAP / LEAVE advice.
- **[Hideout](https://gwazyjustcause.github.io/GrayArea/hideout.html)** — upgrades per station/level and a synced material stash.
- **[Weapons & Ammo](https://gwazyjustcause.github.io/GrayArea/weapons.html)** — choose ammo by weapon and target armour, with local editable recommendations.
- **[Loot prices](https://gwazyjustcause.github.io/GrayArea/loot.html)** — community-sourced item reference catalogue.

## Administration

A separate unlisted `admin.html` page is available with GitHub owner authorization. Administrators can edit prices, names, images and verified item grid dimensions; publish changes; and move items to a recoverable Trash bin. Trashed items are not shown in public Money or Loot Prices.

## Accuracy

New items and mechanics are based on available information from Rogue Ops 0.5. Older wiki pricing is a **reference**, not a guarantee for the current update. The catalogue may sync automatically from [GZW Data](https://github.com/ZoniBoy00/gzw-data). A recent sync timestamp does not certify that an individual price is current.

Hideout progress and personal weapon/ammo and item-price changes are saved locally in the browser; clear storage can erase them.

## Publishing

Static site on GitHub Pages. The independent game data source is community maintained. Gray Area is an unofficial fan project and is not affiliated with MADFINGER Games.




## Inventory data

Backpack and plate carrier grid presets are stored in `data/carry-gear.json`. They come from community Fandom wiki listings. Contradictory or unverified dimensions are visibly flagged in the Money interface. Item geometries are read from the wiki-derived catalogue or Admin-published width/height overrides. When an item's dimensions are missing, Money requires confirmation before claiming the item fits.

The Money Raid Loot Planner saves each player's own raid, prices, and manual items locally; no account is required. The previous Money local storage is retained for backwards compatibility.
