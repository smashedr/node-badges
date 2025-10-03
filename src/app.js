import express from 'express'
import cors from 'cors'

import semver from 'semver'
import camelCase from 'camelcase'
import lucide from 'lucide-static'
import { makeBadge } from 'badge-maker'
import { siGithubactions } from 'simple-icons'

import { GhcrApi } from './api.js'

const app = express()
const port = process.env.PORT || 3000

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
    console.log('getImageTags - tags:', tags)

    tags = tags.filter((tag) => tag !== 'latest')
    console.log('tags - filter(latest):', tags)
    tags = tags.toReversed()
    console.log('tags - toReversed:', tags)
    tags = tags.slice(0, count)
    console.log('tags - slice(count):', tags)
    tags = tags.toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    console.log('tags - localCompare:', tags)

    if (req.params.latest) {
        const message = tags.at(-1)
        console.log('latest - message:', message)

        const badge = getBadge(req, message, 'latest', 'tag')
        // return res.send(badge)
        return sendBadge(res, badge)
    }

    if (req.query.semver !== undefined) {
        tags = tags.filter((str) => semver.valid(str))
        console.log('tags - semver:', tags)
    }
    if (req.query.reversed !== undefined) {
        tags.reverse()
        console.log('tags - reverse:', tags)
    }

    const message = tags.join(` ${req.query.sep || '|'} `)
    console.log('tags - message:', message)

    const badge = getBadge(req, message, 'tags', 'tags')
    // res.send(badge)
    sendBadge(res, badge)
})

app.get('/ghcr/size/:owner/:package{/:tag}', async (req, res) => {
    console.log(req.originalUrl)

    const api = new GhcrApi(req.params.owner, req.params.package)
    const tag = req.params.tag || 'latest'
    const total = await api.getImageSize(tag)
    console.log('getImageSize - total:', total)

    const message = formatSize(total)
    console.log('message:', message)

    const badge = getBadge(req, message, 'size', 'container')
    // res.send(badge)
    sendBadge(res, badge)
})

app.get('/uptime', (req, res) => {
    // Note: this is an internal badge endpoint for server uptime
    const message = getUptime()
    console.log('message:', message)

    const badge = getBadge(req, message, 'uptime', 'clock-arrow-up')
    res.setHeader('Content-Type', 'image/svg+xml')
    res.send(badge)
})

app.get('/badge', (req, res) => {
    // Note: this is a simple-icons testing endpoint
    const uptime = Math.floor(process.uptime())
    const svg = siGithubactions.svg.replace('<path ', '<path fill="#ffffff" ')
    const logo = Buffer.from(svg).toString('base64')
    const badge = makeBadge({
        message: `${uptime} sec`,
        logoBase64: `data:image/svg+xml;base64,${logo}`,
        labelColor: req.query.labelColor || '#555',
        label: req.query.label || 'uptime',
        color: req.query.color || 'brightgreen',
        style: req.query.style || 'flat',
    })
    res.setHeader('Content-Type', 'image/svg+xml')
    // res.send(`<?xml version="1.0" encoding="UTF-8"?>\n${badge}`)
    res.send(badge)
})

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
 * Get Badge
 * @param {Request} req
 * @param {String} message
 * @param {String} label
 * @param {String} icon
 * @return {String}
 */
function getBadge(req, message, label, icon) {
    const logo = getLogo(req, icon)
    // TODO: Handle no logo
    // console.log('logo:', logo)
    return makeBadge({
        message: message.toString(),
        logoBase64: `data:image/svg+xml;base64,${logo}`,
        labelColor: req.query.labelColor || '#555',
        label: req.query.label || label,
        color: req.query.color || 'brightgreen',
        style: req.query.style || 'flat',
    })
}

/**
 * Get Logo String
 * @param {Request} req
 * @param {String} icon
 * @param {String} [color]
 * @return {String}
 */
function getLogo(req, icon, color = '#fff') {
    const iconName = camelCase(req.query.lucide || icon, { pascalCase: true })
    // console.log('iconName:', iconName)
    let svg = lucide[iconName]
    if (!svg) {
        console.warn('SVG NOT FOUND - iconName:', iconName)
        return ''
    }
    const iconColor = req.query.iconColor || color
    // console.log('iconColor:', iconColor)
    const result = svg.replace('<svg', `<svg color="${iconColor}"`)
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
