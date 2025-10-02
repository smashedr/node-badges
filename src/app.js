// noinspection JSUnresolvedReference

import express from 'express'
import cors from 'cors'

// import semver from 'semver'
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
    console.log(`listening on port: ${port}`)
})

app.get('/app-health-check', (req, res) => {
    res.sendStatus(200)
})

app.get('/', (req, res) => {
    const uptime = getUptime()
    const seconds = Math.floor(process.uptime())
    res.send(`Server Uptime: ${uptime} (${seconds} seconds)`)
})

// app.use('/ghcr', (req, res, next) => {
//     res.setHeader('Content-Type', 'image/svg+xml')
//     res.setHeader('Cache-Control', 'public, max-age=3600')
//     next()
// })

app.get('/ghcr/tags/:owner/:package{/:latest}', async (req, res) => {
    console.log(
        `/ghcr/tags/${req.params.owner}/${req.params.package}/${req.params.latest}`
    )
    if (req.params.latest && req.params.latest !== 'latest') res.sendStatus(404)

    const api = new GhcrApi(req.params.owner, req.params.package)
    const tags = await api.getImageTags()
    console.log('getImageTags - tags:', tags)
    const processed = getTags(tags, Number.parseInt(req.query.n) || 3)
    console.log('processed:', processed)

    if (req.params.latest) {
        const message = processed[0]
        console.log('message:', message)

        const badge = getBadge(req, message, 'latest', 'tag')
        // return res.send(badge)
        return sendBadge(res, badge)
    }
    if (req.query.reversed !== undefined) processed.reverse()
    const message = processed.join(` ${req.query.sep || '|'} `)
    console.log('message:', message)

    const badge = getBadge(req, message, 'tags', 'tags')
    // res.send(badge)
    sendBadge(res, badge)
})

app.get('/ghcr/size/:owner/:package{/:tag}', async (req, res) => {
    console.log(`/ghcr/size/${req.params.owner}/${req.params.package}/${req.params.tag}`)

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

/**
 * Get Tags Count
 * @param {String[]} tags
 * @param {Number} count
 * @return {String[]}
 */
function getTags(tags, count = 3) {
    // TODO: Add option to sort by semver and verify reverse() works as expected
    // const sorted = tags.filter((t) => semver.valid(t)).sort(semver.rcompare)
    // console.log('sorted:', sorted)
    tags.reverse()
    const results = []
    for (const tag of tags) {
        if (tag === 'latest') continue
        results.push(tag)
        if (results.length === count) break
    }
    return results
}
