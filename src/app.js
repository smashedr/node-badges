import express from 'express'
import cors from 'cors'

import lucide from 'lucide-static'
import jp from 'jsonpath'
import semver from 'semver'
import camelCase from 'camelcase'
import { parse } from 'yaml'
import { makeBadge } from 'badge-maker'
import * as icons from 'simple-icons'

import { cacheGet, cacheSet, GhcrApi } from './api.js'

const app = express()
const port = process.env.PORT || 3000

// app.use(express.static('src/public'))
app.use(express.json())
app.use(cors())

app.listen(port, () => {
    console.log(`listening on PORT: ${port}`)
})

app.get('/app-health-check', (req, res) => {
    res.sendStatus(200)
})

app.get('/', (req, res) => {
    const uptime = getUptime()
    const seconds = Math.floor(process.uptime())
    res.send(`Version: ${process.env.APP_VERSION} - Uptime: ${uptime} (${seconds} s)`)
})

// app.use('/ghcr', (req, res, next) => {
//     res.setHeader('Content-Type', 'image/svg+xml')
//     res.setHeader('Cache-Control', 'public, max-age=3600')
//     next()
// })

app.get('/ghcr/tags/:owner/:package{/:latest}', async (req, res) => {
    console.log(req.originalUrl)
    if (req.params.latest && req.params.latest !== 'latest') res.sendStatus(404)
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
        return getBadge(req, message, 'latest', 'tag', res)
    }

    if (req.query.reversed !== undefined) {
        tags.reverse()
    }

    const message = tags.join(` ${req.query.sep || '|'} `)
    console.log('tags - message:', message)
    getBadge(req, message, 'tags', 'tags', res)
})

app.get('/ghcr/size/:owner/:package{/:tag}', async (req, res) => {
    console.log(req.originalUrl)

    const api = new GhcrApi(req.params.owner, req.params.package)
    const tag = req.params.tag || 'latest'
    const total = await api.getImageSize(tag)
    console.log('getImageSize - total:', total)

    const message = formatSize(total)
    console.log('message:', message)
    getBadge(req, message, 'size', 'container', res)
})

app.get('/yaml/:url/:path', async (req, res) => {
    console.log(req.originalUrl)
    console.log('req.path:', req.path)
    console.log('req.params.url:', req.params.url)

    const cached = await cacheGet(req.originalUrl)
    console.log('cached:', cached)
    if (cached) return getBadge(req, cached, 'result', 'code', res)

    const url = new URL(req.params.url)
    console.log('url.href:', url.href)

    const response = await fetch(url)
    // console.log('response:', response)
    console.log('response.status:', response.status)

    const length = response.headers.get('content-length')
    console.log('content-length:', length)

    const text = await response.text()
    console.log('text.length:', text.length)
    // const encoder = new TextEncoder().encode(text)
    // console.log('encoder.length:', encoder.length)

    const data = parse(text)
    // console.log('data:', data)

    let result = jp.query(data, req.params.path)[0]
    console.log('result:', result)
    if (req.query.split) {
        const split = result.split(req.query.split)
        result = split[req.query.index || 0]
        console.log('result:', result)
    }
    if (result) {
        await cacheSet(req.originalUrl, result)
        return getBadge(req, result, 'result', 'code-xml', res)
    } else {
        res.sendStatus(404)
    }
})

app.get('/uptime', (req, res) => {
    // Note: this is an internal badge endpoint for server uptime
    console.log(req.originalUrl)
    const message = getUptime()
    console.log('message:', message)
    getBadge(req, message, 'uptime', 'clock-arrow-up', res)
})

/**
 * Get Badge
 * @param {Request} req
 * @param {String} message
 * @param {String} label
 * @param {String} icon
 * @param {Response} [res]
 * @return {String}
 */
function getBadge(req, message, label, icon, res) {
    const data = {
        message: message.toString(),
        label: req.query.label || label,
        color: req.query.color || 'brightgreen',
        style: req.query.style || 'flat',
    }
    const logo = getLogo(req, icon)
    if (logo) {
        data.logoBase64 = `data:image/svg+xml;base64,${logo}`
        data.labelColor = req.query.labelColor || '#555'
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
 * @param {Request} req
 * @param {String} icon
 * @param {String} [color]
 * @return {String}
 */
function getLogo(req, icon, color = '#fff') {
    if (req.query.icon !== undefined && !req.query.icon) return ''
    const iconName = req.query.icon || req.query.lucide || icon
    const name = camelCase(iconName, { pascalCase: true })
    // console.log('name:', name)
    let svg
    let colorType
    if (req.query.icon) {
        // console.log('Simple Icons')
        svg = icons[`si${name}`].svg
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

    const iconColor = req.query.iconColor || color
    // console.log('iconColor:', iconColor)
    const result = svg.replace('<svg', `<svg ${colorType}="${iconColor}"`)
    // console.log('result:', result)
    return Buffer.from(result).toString('base64')
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
