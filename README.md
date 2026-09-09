# Gray Area

A fast, searchable field index for **Gray Zone Warfare**. It covers weapons, ammunition, attachments, equipment, medical supplies, keys, task items, valuables and other findable objects.

## Automatic data updates

The `Sync GZW field data` GitHub Action runs daily and discovers every dataset exposed by the community-maintained [GZW Data](https://github.com/ZoniBoy00/gzw-data) project. New categories therefore appear without changing the website. Safety checks reject suspiciously small updates before they can replace the existing catalogue.

The site is a fan project and is not affiliated with MADFINGER Games. Game names and imagery belong to their respective owners. Source data is community-maintained and may contain mistakes.

## Publish

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. Then run `Sync GZW field data` once from the Actions tab. Future data changes and site deployments are automatic.
