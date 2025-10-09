import express from 'express'
import cors from 'cors'

import lucide from 'lucide-static'
import semver from 'semver'
import camelCase from 'camelcase'
import { makeBadge } from 'badge-maker'
import * as icons from 'simple-icons'

import {
    cacheDelete,
    getJSONPath,
    getVTReleaseStats,
    getVTStats,
    GhcrApi,
} from './api.js'

const app = express()
const port = process.env.PORT || 3000

app.use(express.static('src/public'))
app.use(express.json())
app.use(cors())

app.set('views', '/app/src/views')
app.set('view engine', 'pug')
app.disable('view cache')

console.log('GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? 'Loaded' : 'MISSING')
console.log('VT_API_KEY:', process.env.VT_API_KEY ? 'Loaded' : 'MISSING')

app.listen(port, () => {
    console.log(`listening on PORT: ${port}`)
})

app.get('/app-health-check', (req, res) => {
    res.sendStatus(200)
})

app.get('/', (req, res) => {
    const uptime = getUptime()
    const seconds = Math.floor(process.uptime())
    // res.send(`Version: ${process.env.APP_VERSION} - Uptime: ${uptime} (${seconds} s)`)
    res.render('index', {
        version: process.env.APP_VERSION,
        uptime: uptime,
        seconds: seconds,
        title: 'Node Badges',
        source: 'https://github.com/smashedr/node-badges',
        docs: 'https://smashedr.github.io/node-badges-docs',
    })
})

// app.get('/test', async (req, res) => {
//     res.sendStatus(200)
// })

// app.use('/ghcr', (req, res, next) => {
//     res.setHeader('Content-Type', 'image/svg+xml')
//     res.setHeader('Cache-Control', 'public, max-age=3600')
//     next()
// })

// app.use((req, res, next) => {
//     if (req.method === 'PURGE') {
//         console.log('PURGE request for URL:', req.originalUrl)
//         console.log('req:', req)
//         res.status(200).send('PURGE received')
//         return
//     }
//     next()
// })

app.all('/vt/:sha', async (req, res, next) => {
    if (req.method === 'PURGE') {
        console.log('PURGE:', req.originalUrl)
        const key = `/vt/${req.params.sha}`
        return purgeKey(res, key)
    }
    next()
})

app.get(
    '/vt/:sha',
    errorBadgeHandler(async (req, res) => {
        console.log(req.originalUrl)
        if (!process.env.VT_API_KEY) throw new Error('Missing VT API Key')
        const stats = await getVTStats(req.params.sha)
        // NOTE: Duplicate Code
        console.log('stats:', stats)
        const message = `${stats.malicious}/${stats.suspicious}/${stats.undetected}`
        console.log('message:', message)
        const query = structuredClone(req.query)
        if (!query.lucide && !query.icon) query.icon = 'virustotal'
        query.color = query.color || getBadGradient(stats.malicious + stats.suspicious)
        getBadge(query, message, req.params.sha.slice(0, 6), '', res)
    })
)

app.all('/vt/:owner/:repo/:asset{/:tag}', async (req, res, next) => {
    if (req.method === 'PURGE') {
        console.log('PURGE:', req.originalUrl)
        const tag = req.params.tag || 'latest'
        const key = `${req.params.owner}/${req.params.repo}/${req.params.asset}/${tag}`
        return purgeKey(res, key)
    }
    next()
})

app.get(
    '/vt/:owner/:repo/:asset{/:tag}',
    errorBadgeHandler(async (req, res) => {
        console.log(req.originalUrl)
        if (!process.env.VT_API_KEY) throw new Error('Missing VT API Key')
        const stats = await getVTReleaseStats(req)
        // NOTE: Duplicate Code
        console.log('stats:', stats)
        const message = `${stats.malicious}/${stats.suspicious}/${stats.undetected}`
        console.log('message:', message)
        const query = structuredClone(req.query)
        if (!query.lucide && !query.icon) query.icon = 'virustotal'
        query.color = query.color || getBadGradient(stats.malicious + stats.suspicious)
        getBadge(query, message, req.params.asset, '', res)
    })
)

app.all('/ghcr/tags/:owner/:package{/:latest}', async (req, res, next) => {
    if (req.method === 'PURGE') {
        console.log('PURGE:', req.originalUrl)
        const key = `ghcr/tags/${req.params.owner}/${req.params.package}/tags/list`
        return purgeKey(res, key)
    }
    next()
})

app.get(
    '/ghcr/tags/:owner/:package{/:latest}',
    errorBadgeHandler(async (req, res) => {
        console.log(req.originalUrl)
        if (req.params.latest && req.params.latest !== 'latest') {
            return res.sendStatus(404)
        }
        const count = Number.parseInt(req.query.n) || 3
        console.log('count:', count)

        const api = new GhcrApi(req.params.owner, req.params.package)
        let tags = await api.getImageTags()
        tags = tags.filter((tag) => tag !== 'latest')
        tags = tags.toReversed()

        if (req.query.semver !== undefined) {
            tags = tags.filter((str) => semver.valid(str))
        }

        tags = tags.slice(0, count)
        tags = tags.toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true }))

        if (req.params.latest) {
            const message = tags.at(-1)
            console.log('latest - message:', message)
            return getBadge(req.query, message, 'latest', 'tag', res)
        }

        if (req.query.reversed !== undefined) {
            tags.reverse()
        }

        const message = tags.join(` ${req.query.sep || '|'} `)
        console.log('tags - message:', message)
        getBadge(req.query, message, 'tags', 'tags', res)
    })
)

app.all('/ghcr/size/:owner/:package{/:tag}', async (req, res, next) => {
    if (req.method === 'PURGE') {
        console.log('PURGE:', req.originalUrl)
        const tag = req.params.tag ? req.params.tag : 'latest'
        const key = `ghcr/size/${req.params.owner}/${req.params.package}/${tag}`
        return purgeKey(res, key)
    }
    next()
})

app.get(
    '/ghcr/size/:owner/:package{/:tag}',
    errorBadgeHandler(async (req, res) => {
        console.log(req.originalUrl)

        const api = new GhcrApi(req.params.owner, req.params.package)
        const tag = req.params.tag || 'latest'
        const total = await api.getImageSize(tag)
        console.log('getImageSize - total:', total)

        const message = formatSize(total)
        console.log('message:', message)
        getBadge(req.query, message, 'size', 'container', res)
    })
)

app.get(
    '/static/:message{/:label}',
    errorBadgeHandler(async (req, res) => {
        console.log(req.originalUrl)
        console.log('req.params.message:', req.params.message)
        console.log('req.params.label:', req.params.label)
        const query = structuredClone(req.query)
        if (!req.params.label && !query.label && !query.labelColor) {
            query.labelColor = query.color || 'brightgreen'
        }
        console.log('query:', query)
        getBadge(query, req.params.message, req.params.label, '', res)
    })
)

app.all('/:type/:url/:path', async (req, res, next) => {
    if (!['yaml', 'json'].includes(req.params.type)) return next()
    if (req.method === 'PURGE') {
        console.log('PURGE:', req.originalUrl)
        return purgeKey(res, req.originalUrl)
    }
    next()
})

app.get(
    '/:type/:url/:path',
    errorBadgeHandler(async (req, res) => {
        console.log(req.originalUrl)
        console.log('req.params.type:', req.params.type)
        if (!['yaml', 'json'].includes(req.params.type)) return res.sendStatus(404)

        const message = getJSONPath(req)
        console.log('message:', message)
        return getBadge(req.query, message, 'result', 'code-xml', res)
    })
)

app.get(
    '/uptime',
    errorBadgeHandler(async (req, res) => {
        console.log(req.originalUrl)
        const message = getUptime()
        console.log('message:', message)
        getBadge(req.query, message, 'uptime', 'clock-arrow-up', res)
    })
)

function errorBadgeHandler(handler) {
    return async (req, res) => {
        try {
            await handler(req, res)
        } catch (error) {
            console.error(error)
            console.log('error.message:', error.message)
            const data = {
                message: error.message,
                color: 'red',
                style: req.query.style || 'flat',
            }
            console.log('data:', data)
            const badge = makeBadge(data)
            if (res) sendBadge(res, badge)
        }
    }
}

/**
 * Get Badge
 * TODO: Update to accept an Object argument
 * @param {Object} query req.query
 * @param {String} message Badge Message
 * @param {String} [label] Default Label
 * @param {String} [icon] Default Icon
 * @param {Response} [res] To also sendBadge
 * @return {String}
 */
function getBadge(query, message, label = '', icon = '', res = null) {
    console.log(`getBadge: ${message} - label: ${label} - icon: ${icon}`)
    const data = {
        message: message.toString(),
        color: query.color || 'brightgreen',
        style: query.style || 'flat',
    }
    label = query.label !== undefined ? query.label : label
    if (label) {
        data.label = label
    }
    const logo = getLogo(query, icon)
    if (logo) {
        data.logoBase64 = `data:image/svg+xml;base64,${logo}`
        data.labelColor = query.labelColor || '#555'
    }
    // console.log('data:', data)
    const badge = makeBadge(data)
    if (res) sendBadge(res, badge)
    return badge
}

/**
 * Send Badge
 * @param {Response} res
 * @param {String} badge
 */
function sendBadge(res, badge) {
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(badge)
}

/**
 * Get Logo String
 * @param {Object} query
 * @param {String} icon
 * @param {String} [color]
 * @return {String}
 */
function getLogo(query, icon, color = '#fff') {
    if (query.icon !== undefined && !query.icon) return ''
    const iconName = query.icon || query.lucide || icon
    const name = camelCase(iconName, { pascalCase: true })
    // console.log('name:', name)
    let svg
    let colorType
    if (query.icon) {
        // console.log('Simple Icons')
        svg = icons[`si${name}`]?.svg
        colorType = 'fill'
    } else {
        // console.log('Lucide Icon')
        svg = lucide[name]
        colorType = 'color'
    }

    if (!svg) {
        console.warn(`SVG NOT FOUND - icon: ${iconName} - name: ${name}`)
        return ''
    }

    const iconColor = query.iconColor || color
    // console.log('iconColor:', iconColor)
    const result = svg.replace('<svg', `<svg ${colorType}="${iconColor}"`)
    // console.log('result:', result)
    return Buffer.from(result).toString('base64')
}

function getBadGradient(bad) {
    console.log('getBadGradient:', bad)
    const colors = [
        '#44cc11',
        '#85c718',
        '#b0c42d',
        '#dfb317',
        '#e39934',
        '#e27c44',
        '#e05d44',
    ]
    return colors[bad] || colors.at(-1)
}

/**
 * Get Size String
 * @param {Number} bytes
 * @return {String}
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i]
}

/**
 * Get Uptime String
 * @return {String}
 */
function getUptime() {
    const seconds = process.uptime()
    if (seconds < 60) return `${Math.floor(seconds)} sec`
    const minutes = seconds / 60
    if (minutes < 60) return `${Math.floor(minutes)} min`
    const hours = minutes / 60
    if (hours < 24) return `${Math.floor(hours)} hrs`
    const days = hours / 24
    return `${Math.floor(days)} days`
}

/**
 * Purge Key Response
 * @param {Response} res
 * @param {String} key
 * @return {Promise<void>}
 */
async function purgeKey(res, key) {
    console.log(`purgeKey: ${key}`)
    const result = await cacheDelete(key)
    console.log('result:', result)
    res.send(result.toString())
}
