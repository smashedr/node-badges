// noinspection JSUnresolvedReference
import express from 'express'
import cors from 'cors'

import camelCase from 'camelcase'
import lucide from 'lucide-static'
import { makeBadge } from 'badge-maker'
import { siGithubactions } from 'simple-icons'

import { Api } from './api.js'

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
    const uptime = Math.floor(process.uptime() / 60)
    res.send(`Uptime: ${uptime} minutes`)
})

app.get('/ghcr/size/:owner/:package{/:tag}', async (req, res) => {
    console.log('req.params.owner:', req.params.owner)
    console.log('req.params.package:', req.params.package)
    console.log('req.params.tag:', req.params.tag)

    const api = new Api(req.params.owner, req.params.package)
    const tag = req.params.tag || 'latest'
    console.log('tag:', tag)
    const total = await api.getImageSize(tag)
    console.log('total:', total)

    const message = formatSize(total)
    console.log('message:', message)

    const badge = getBadge(req, message, 'scale')
    res.setHeader('Content-Type', 'image/svg+xml')
    // res.send(`<?xml version="1.0" encoding="UTF-8"?>\n${badge}`)
    res.send(badge)
})

app.get('/uptime', (req, res) => {
    const uptime = Math.floor(process.uptime())

    const message = `${uptime} sec`
    console.log('message:', message)

    const badge = getBadge(req, message, 'clock-arrow-up')
    res.setHeader('Content-Type', 'image/svg+xml')
    res.send(badge)
})

app.get('/badge', (req, res) => {
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
    res.send(badge)
})

function getBadge(req, message, icon) {
    const logo = getLogo(req, icon)
    return makeBadge({
        message: message.toString(),
        logoBase64: `data:image/svg+xml;base64,${logo}`,
        labelColor: req.query.labelColor || '#555',
        label: req.query.label || 'image',
        color: req.query.color || 'brightgreen',
        style: req.query.style || 'flat',
    })
}

function getLogo(req, icon, color = '#fff') {
    const iconName = camelCase(req.query.lucide || icon, { pascalCase: true })
    console.log('iconName:', iconName)
    let svg = lucide[iconName]
    if (!svg) {
        console.warn('SVG NOT FOUND:', iconName)
        return
    }
    const iconColor = req.query.iconColor || color
    console.log('iconColor:', iconColor)
    const result = svg.replace('<svg', `<svg color="${iconColor}"`)
    return Buffer.from(result).toString('base64')
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i]
}
