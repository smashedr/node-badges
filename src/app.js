import './instrument.js'

import express from 'express'
import cors from 'cors'

import camelCase from 'camelcase'
import createDebug from 'debug'
import chroma from 'chroma-js'
import lucide from 'lucide-static'
import schedule from 'node-schedule'
import semver from 'semver'
import { makeBadge } from 'badge-maker'
import * as icons from 'simple-icons'

import {
    cacheDelete,
    cacheGet,
    getJSONPath,
    getVTReleaseStats,
    getVTStats,
    GHCRApi,
    incrKey,
    sendInflux,
} from './api.js'

let Sentry
if (process.env.SENTRY_URL) {
    Sentry = await import('@sentry/node')
}

const debug = createDebug('app:app')

const app = express()
const port = process.env.PORT || 3000

app.use(express.static('src/public'))
app.use(cors({ methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'PURGE'] }))

app.set('views', 'src/views')
app.set('view engine', 'pug')
app.disable('view cache')
app.disable('x-powered-by')

console.log(`APP_VERSION: ${process.env.APP_VERSION}`)
console.log(`GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? 'Loaded' : 'MISSING'}`)
console.log(`VT_API_KEY: ${process.env.VT_API_KEY ? 'Loaded' : 'MISSING'}`)
console.log(`DEBUG: ${process.env.DEBUG || 'LOGGING OFF'}`)

schedule.scheduleJob('*/5 * * * *', function () {
    sendInflux().catch(console.error)
})

const server = app.listen(port, () => {
    console.log(`Listening on PORT: ${port}`)
})

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing server')
    server.close(async (err) => {
        console.log('server closed')
        if (err) console.error(err)
        // NOTE: Determine if this location is correct
        await schedule.gracefulShutdown()
        // NOTE: Determine if we should sendInflux on close
        // await sendInflux()
        process.exit(0)
    })
})

app.get('/app-health-check', (req, res) => {
    res.sendStatus(200)
})

app.get('/', async (req, res) => {
    const uptime = Math.floor(process.uptime())
    const fmt = (n) => Math.floor(n).toString().padStart(2, '0')
    res.render('index', {
        uptime,
        seconds: uptime % 60,
        minutes: fmt((uptime % 3600) / 60),
        hours: fmt((uptime % 86400) / 3600),
        days: Math.floor(uptime / 86400),
        count: await cacheGet('badges_total', 0),
        version: process.env.APP_VERSION,
        title: 'Node Badges',
        links: {
            Source: 'https://github.com/smashedr/node-badges',
            Docs: 'https://smashedr.github.io/node-badges-docs',
            Grafana:
                'https://cssnr.grafana.net/public-dashboards/8a24a95171fe4127ada92afb071b9331',
        },
        // badges: [{ src: '', href: '' }],
    })
})

// app.get('/test{/:extra}', async (req, res) => {
//     throw new Error('ralf brok ei t')
//     // res.sendStatus(200)
//
//     // const total = await cacheGet('badges_total')
//     // debug('badges_total:', total)
//     //
//     // if (req.params.extra) {
//     //     debug('req.params.extra:', req.params.extra)
//     //     sendInflux().catch(console.error)
//     // }
// })

app.get('/colors{/:index}', async (req, res) => {
    debug(req.originalUrl)
    const index = req.params.index || 0
    debug('index:', index)
    const color = getRangedColor(req, index)
    debug('color:', color)
    // noinspection HtmlRequiredLangAttribute
    res.send(`<html><body style="margin:0;background:${color}"></body></html>`)
})

// app.use('/ghcr', (req, res, next) => {
//     res.setHeader('Content-Type', 'image/svg+xml')
//     res.setHeader('Cache-Control', 'public, max-age=3600')
//     next()
// })

// app.use((req, res, next) => {
//     if (req.method === 'PURGE') {
//         debug('PURGE request for URL:', req.originalUrl)
//         debug('req:', req)
//         res.status(200).send('PURGE received')
//         return
//     }
//     next()
// })

app.all('/vt/:type/:hash', async (req, res, next) => {
    if (['PURGE', 'POST'].includes(req.method)) {
        debug(`PURGE: ${req.method}`, req.originalUrl)
        if (!['id', 'sha'].includes(req.params.type)) return next()
        const hash = req.params.hash.includes(':')
            ? req.params.hash.split(':')[1]
            : req.params.hash
        // debug('hash:', hash)
        const key = `/vt/id/${hash}`
        return purgeKey(res, key)
    }
    next()
})

app.get('/vt/:type/:hash', async (req, res) => {
    debug(req.originalUrl)
    // debug('req.params.type:', req.params.type)
    if (!['id', 'sha'].includes(req.params.type)) return res.sendStatus(404)
    if (!process.env.VT_API_KEY) throw new Error('Missing VT API Key')

    const hash = req.params.hash.includes(':')
        ? req.params.hash.split(':')[1]
        : req.params.hash
    // debug('hash:', hash)

    const stats = await getVTStats(hash)
    // debug('stats:', stats)
    const message = `${stats.malicious}/${stats.suspicious}/${stats.undetected}`
    // debug('message:', message)
    const color = getRangedColor(req, stats.malicious + stats.suspicious)
    const options = { label: hash.slice(0, 6), icon: 'virustotal', color }
    getBadge(message, req.query, options, res)
})

app.all('/vt/:owner/:repo/:asset{/:tag}', async (req, res, next) => {
    if (['PURGE', 'POST'].includes(req.method)) {
        debug(`PURGE: ${req.method}`, req.originalUrl)
        const tag = req.params.tag || 'latest'
        const key = `${req.params.owner}/${req.params.repo}/${req.params.asset}/${tag}`
        return purgeKey(res, key)
    }
    next()
})

app.get('/vt/:owner/:repo/:asset{/:tag}', async (req, res) => {
    debug(req.originalUrl)
    if (!process.env.VT_API_KEY) throw new Error('Missing VT API Key')
    const stats = await getVTReleaseStats(req)
    // debug('stats:', stats)
    const message = `${stats.malicious}/${stats.suspicious}/${stats.undetected}`
    // debug('message:', message)
    const color = getRangedColor(req, stats.malicious + stats.suspicious)
    const options = { label: req.params.asset, icon: 'virustotal', color }
    getBadge(message, req.query, options, res)
})

app.all('/ghcr/tags/:owner/:package{/:latest}', async (req, res, next) => {
    if (['PURGE', 'POST'].includes(req.method)) {
        debug(`PURGE: ${req.method}`, req.originalUrl)
        const key = `ghcr/tags/${req.params.owner}/${req.params.package}/tags/list`
        return purgeKey(res, key)
    }
    next()
})

app.get('/ghcr/tags/:owner/:package{/:latest}', async (req, res) => {
    debug(req.originalUrl)
    if (req.params.latest && req.params.latest !== 'latest') {
        return res.sendStatus(404)
    }
    const count = Number.parseInt(req.query.n) || 3
    // debug('count:', count)

    const api = new GHCRApi(req.params.owner, req.params.package)
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
        // debug('latest - message:', message)
        return getBadge(message, req.query, { label: 'latest', lucide: 'tag' }, res)
    }

    if (req.query.reversed !== undefined) {
        tags.reverse()
    }

    const message = tags.join(` ${req.query.sep || '|'} `)
    // debug('tags - message:', message)
    getBadge(message, req.query, { label: 'tags', lucide: 'tags' }, res)
})

app.all('/ghcr/size/:owner/:package{/:tag}', async (req, res, next) => {
    if (['PURGE', 'POST'].includes(req.method)) {
        debug(`PURGE: ${req.method}`, req.originalUrl)
        const tag = req.params.tag ? req.params.tag : 'latest'
        const key = `ghcr/size/${req.params.owner}/${req.params.package}/${tag}`
        return purgeKey(res, key)
    }
    next()
})

app.get('/ghcr/size/:owner/:package{/:tag}', async (req, res) => {
    debug(req.originalUrl)

    const api = new GHCRApi(req.params.owner, req.params.package)
    const tag = req.params.tag || 'latest'
    const total = await api.getImageSize(tag)
    // debug('getImageSize - total:', total)

    const message = formatSize(total)
    // debug('message:', message)
    getBadge(message, req.query, { label: 'size', lucide: 'container' }, res)
})

app.get('/static/:message{/:label}', async (req, res) => {
    debug(req.originalUrl)
    // debug(`message/label: ${req.params.message} / ${req.params.label}`)
    // NOTE: This endpoint uses custom logic to make a "static" badge
    //  This needs to be fixed, the icon does not show up like shields
    const query = structuredClone(req.query)
    if (!req.params.label && !query.label && !query.labelColor) {
        query.labelColor = query.color || 'brightgreen'
    }
    // debug('query:', query)
    getBadge(req.params.message, query, { label: req.params.label }, res)
})

app.all('/:type/:url/:path', async (req, res, next) => {
    if (!['yaml', 'json'].includes(req.params.type)) return next()
    if (['PURGE', 'POST'].includes(req.method)) {
        debug(`PURGE: ${req.method}`, req.originalUrl)
        return purgeKey(res, req.path)
    }
    next()
})

app.get('/:type/:url/:path', async (req, res) => {
    debug(req.originalUrl)
    // debug('req.params.type:', req.params.type)
    if (!['yaml', 'json'].includes(req.params.type)) return res.sendStatus(404)

    const message = await getJSONPath(req)
    // debug('message:', message)
    getBadge(message, req.query, { label: 'result', lucide: 'code-xml' }, res)
})

app.get('/uptime', async (req, res) => {
    debug(req.originalUrl)
    const message = getUptime()
    // debug('message:', message)
    getBadge(message, req.query, { label: 'uptime', lucide: 'clock-arrow-up' }, res)
})

// Handler - 404
app.use((req, res) => {
    debug('404 - originalUrl:', req.originalUrl)
    const data = {
        message: '404 - URL Not Found',
        color: 'red',
        style: req.query.style || 'flat',
    }
    debug('404 data:', data)
    // noinspection JSCheckFunctionSignatures
    const badge = makeBadge(data)
    sendBadge(res, badge, 404)
    incrKey('badges_404').catch(console.error)
})

// Handler - Error
app.use(errorHandler)

// Handler - Sentry Error - NOTE: This only catches errorHandler errors currently...
if (Sentry) Sentry.setupExpressErrorHandler(app)

function errorHandler(err, req, res) {
    // console.log('errorHandler:', err)
    debug('errorHandler - originalUrl:', req.originalUrl)
    debug('err.message:', err.message)
    const data = {
        message: err.message || 'Unknown Error',
        color: 'red',
        style: req.query.style || 'flat',
    }
    debug('data:', data)
    const badge = makeBadge(data)
    sendBadge(res, badge)
    incrKey('badges_error').catch(console.error)
}

/**
 * Set SVG Headers
 * @param {express.Response} res
 */
function setHeaders(res) {
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'public, max-age=3600')
}

/**
 * Send Badge
 * @param {express.Response} res
 * @param {string} badge
 * @param {number} [status]
 */
function sendBadge(res, badge, status = 200) {
    setHeaders(res)
    res.status(status).send(badge)
}

/**
 * Get Badge
 * @param {string} message Badge Message
 * @param {object} [query] req.query Object
 * @param {object} [options] Badge Options
 * @param {express.Response} [res] To sendBadge
 * @return {string}
 */
function getBadge(message, query = {}, options = {}, res = null) {
    const opts = { color: '', label: '', icon: '', lucide: '', ...options }
    // debug('--- opts:', opts)
    const data = {
        message: message.toString(),
        color: query.color || opts.color || 'brightgreen',
        style: query.style || 'flat',
    }
    const label = query.label !== undefined ? query.label : opts.label
    if (label) data.label = label
    const logo = getLogo(query, opts)
    if (logo) {
        data.logoBase64 = `data:image/svg+xml;base64,${logo}`
        data.labelColor = query.labelColor || '#555'
    }
    // debug('data:', data)
    const badge = makeBadge(data)
    if (res) sendBadge(res, badge)
    incrKey('badges_total').catch(console.error)
    return badge
}

/**
 * Get Logo String
 * @param {object} query
 * @param {object} opts
 * @param {string} [color]
 * @return {string}
 */
function getLogo(query, opts, color = '#fff') {
    // debug('query.icon:', query.icon)
    if (query.icon !== undefined && !query.icon) return ''
    const iconName = query.icon || query.lucide || opts.icon || opts.lucide
    // debug('iconName:', iconName)

    const name = camelCase(iconName, { pascalCase: true })
    // debug('name:', name)
    if (!name) return ''

    let svg, colorType
    if ((query.icon || opts.icon) && !query.lucide) {
        // debug('Simple Icons')
        svg = icons[`si${name}`]?.svg
        colorType = 'fill'
    } else {
        // debug('Lucide Icon')
        svg = lucide[name]
        colorType = 'color'
    }

    if (!svg) {
        console.warn(`SVG NOT FOUND - icon: ${iconName} - name: ${name}`)
        return ''
    }

    const iconColor = query.iconColor || color
    // debug('iconColor:', iconColor)
    const result = svg.replace('<svg', `<svg ${colorType}="${iconColor}"`)
    // debug('result:', result)
    return Buffer.from(result).toString('base64')
}

/**
 * Purge Key Response
 * @param {express.Response} res
 * @param {string} key
 * @return {Promise<void>}
 */
async function purgeKey(res, key) {
    debug(`purgeKey: ${key}`)
    const result = await cacheDelete(key)
    debug('result:', result)
    res.send(result.toString())
    if (result) {
        incrKey('purge_hit').catch(console.error)
    } else {
        incrKey('purge_miss').catch(console.error)
    }
}

/**
 * Get Size String
 * @param {number} bytes
 * @return {string}
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i]
}

/**
 * Get Uptime String
 * @return {string}
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
 * Get Ranged Color w/ Options
 * @param {express.Request} req
 * @param {number} index
 * @param {object} [options]
 * @return {string}
 */
function getRangedColor(req, index, options = {}) {
    const opts = { total: 8, start: '#44cc11', end: '#e05d44', ...options }
    opts.total = Number.parseInt(req.query.n || opts.total)
    opts.start = req.query.start || opts.start
    opts.end = req.query.end || opts.end
    const colors = chroma
        .scale([opts.start, opts.end])
        .mode('lab')
        .colors(opts.total + 1)
    // debug('colors:', colors)
    // colors.forEach((color) => debug(color))
    const idx = Math.max(0, Math.min(opts.total, index))
    // debug(`index: ${idx} / ${colors.length - 1}`)
    return colors[idx]
}
