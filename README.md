[![Image Size](https://badges.cssnr.com/ghcr/size/smashedr/node-badges?color=brightgreen)](https://github.com/smashedr/node-badges/pkgs/container/node-badges)
[![GitHub Release Version](https://img.shields.io/github/v/release/smashedr/node-badges?logo=github)](https://github.com/smashedr/node-badges/releases/latest)
[![Deployments Pages](https://img.shields.io/github/deployments/smashedr/node-badges/swarm?logo=portainer&logoColor=white&label=swarm)](https://badges.cssnr.com/)
[![Workflow Release](https://img.shields.io/github/actions/workflow/status/smashedr/node-badges/release.yaml?logo=cachet&label=release)](https://github.com/smashedr/node-badges/actions/workflows/release.yaml)
[![Workflow Build](https://img.shields.io/github/actions/workflow/status/smashedr/node-badges/build.yaml?logo=cachet&label=build)](https://github.com/smashedr/node-badges/actions/workflows/build.yaml)
[![Workflow Lint](https://img.shields.io/github/actions/workflow/status/smashedr/node-badges/lint.yaml?logo=cachet&label=lint)](https://github.com/smashedr/node-badges/actions/workflows/lint.yaml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=smashedr_node-badges&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=smashedr_node-badges)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/smashedr/node-badges?logo=github&label=updated)](https://github.com/smashedr/node-badges/pulse)
[![GitHub Contributors](https://img.shields.io/github/contributors-anon/smashedr/node-badges?logo=github)](https://github.com/smashedr/node-badges/graphs/contributors)
[![GitHub Repo Size](https://img.shields.io/github/repo-size/smashedr/node-badges?logo=bookstack&logoColor=white&label=repo%20size)](https://github.com/smashedr/node-badges?tab=readme-ov-file#readme)
[![GitHub Top Language](https://img.shields.io/github/languages/top/smashedr/node-badges?logo=htmx)](https://github.com/smashedr/node-badges)
[![GitHub Discussions](https://img.shields.io/github/discussions/smashedr/node-badges?logo=github)](https://github.com/smashedr/node-badges/discussions)
[![GitHub Forks](https://img.shields.io/github/forks/smashedr/node-badges?style=flat&logo=github)](https://github.com/smashedr/node-badges/forks)
[![GitHub Repo Stars](https://img.shields.io/github/stars/smashedr/node-badges?style=flat&logo=github)](https://github.com/smashedr/node-badges/stargazers)
[![GitHub Org Stars](https://img.shields.io/github/stars/cssnr?style=flat&logo=github&label=org%20stars)](https://cssnr.github.io/)
[![Discord](https://img.shields.io/discord/899171661457293343?logo=discord&logoColor=white&label=discord&color=7289da)](https://discord.gg/wXy6m2X8wY)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-72a5f2?logo=kofi&label=support)](https://ko-fi.com/cssnr)

# Node Badges

This is a Work in Progress.

- [Badges](#badges)
- [Query Parameters](#query-parameters)

## Badges

Available Badges:

- [GHCR Image Size](#ghcr-image-size)

### GHCR Image Size

[![Image Size](https://badges.cssnr.com/ghcr/size/smashedr/node-badges)](https://github.com/smashedr/node-badges/pkgs/container/node-badges)

`/ghcr/size/owner/pacakge/tag`

Without the `tag` it defaults to `latest`

- `https://badges.cssnr.com/ghrc/size/owner/package`
- `https://badges.cssnr.com/ghrc/size/owner/package/latest`

_Supports all available [Query Parameters](#query-parameters)._

[![Image Size](https://badges.cssnr.com/ghcr/size/smashedr/node-badges?labelColor=blueviolet&lucide=container&color=seagreen&style=for-the-badge&label=my%20image)](#query-parameters)

```text
https://badges.cssnr.com/ghcr/size/smashedr/node-badges?labelColor=blueviolet&lucide=container&color=seagreen&style=for-the-badge&label=my%20image
```

## Query Parameters

| Parameter    | Default&nbsp;Param&nbsp;Value | Description&nbsp;of&nbsp;the&nbsp;Parameter                 |
| :----------- | :---------------------------: | :---------------------------------------------------------- |
| `style`      |            `flat`             | `plastic`, `flat`, `flat-square`, `for-the-badge`, `social` |
| `color`      |        badge specific         | Badge Background Color (right side)                         |
| `label`      |        badge specific         | Label Text (left hand side)                                 |
| `labelColor` |        badge specific         | Label Background Color (left hand side)                     |
| `lucide`     |        badge specific         | Name of a [Lucide Icon](https://lucide.dev/icons/)          |
| `iconColor`  |            `#fff`             | Icon Color                                                  |

For more details see the documentation for the related library, [badge-maker](https://www.npmjs.com/package/badge-maker).

_More examples coming soon..._
