import axios from 'axios'
import jp from 'jsonpath'
// noinspection JSUnresolvedReference
import { Buffer } from 'node:buffer'
import { createClient } from 'redis'
import { GitHubApi } from './github.js'
import { parse } from 'yaml'
import { VTApi } from './virustotal.js'
import { InfluxDB, Point } from '@influxdata/influxdb-client'

// const NodeCache = require('node-cache')
// const cache = new NodeCache({ stdTTL: 60 * 60 })

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379'
console.log(`REDIS_URL: ${redisUrl}`)
const client = createClient({ url: redisUrl })
await client.connect()

let influxClient
if (process.env.INFLUX_URL && process.env.INFLUX_TOKEN) {
    console.log(`INFLUX_URL: ${process.env.INFLUX_URL}`)
    influxClient = new InfluxDB({
        url: process.env.INFLUX_URL,
        token: process.env.INFLUX_TOKEN,
    })
}

export class GhcrApi {
    /**
     * GHCR API
     * @param {String} packageOwner
     * @param {String} packageName
     */
    constructor(packageOwner, packageName) {
        if (!packageOwner || !packageName) throw new Error('Invalid Arguments')
        this.packageOwner = packageOwner
        this.packageName = packageName
        this.token = Buffer.from(`v1:${packageOwner}/${packageName}:0`).toString('base64')
        // noinspection JSCheckFunctionSignatures
        this.client = axios.create({
            baseURL: 'https://ghcr.io/v2',
            headers: {
                accept: 'application/vnd.oci.image.index.v1+json,application/vnd.oci.image.manifest.v1+json',
                'x-github-api-version': '2022-11-28',
                authorization: `Bearer ${this.token}`,
            },
        })
    }

    /**
     * Get Image Tags
     * @return {Promise<Array>}
     */
    async getImageTags() {
        const url = `${this.packageOwner}/${this.packageName}/tags/list`
        const key = `ghcr/tags/${url}`
        const cached = await cacheGet(key)
        if (cached) return cached
        console.log(`-- CACHE MISS: ${key}`)

        const response = await this.client.get(url)
        await cacheSet(key, response.data.tags)
        return response.data.tags
    }

    /**
     * Get Image Size
     * @return {Promise<Number>}
     */
    async getImageSize(tag = 'latest') {
        const key = `ghcr/size/${this.packageOwner}/${this.packageName}/${tag}`
        const cached = await cacheGet(key)
        if (cached) return cached
        console.log(`-- CACHE MISS: ${key}`)

        const indexManifest = await this.getManifest(tag)
        console.log('mediaType:', indexManifest.mediaType)

        let totalSize = 0

        if (
            !indexManifest.mediaType.includes('list') &&
            !indexManifest.mediaType.includes('index')
        ) {
            // console.log('indexManifest - !list + !index:', indexManifest)
            const size = indexManifest.layers.reduce((sum, layer) => sum + layer.size, 0)
            totalSize = size + (indexManifest.config.size || 0)
            // console.log('totalSize:', totalSize)
            await cacheSet(key, totalSize)
            return totalSize
        }

        console.log('indexManifest.manifests?.length:', indexManifest.manifests?.length)
        for (const m of indexManifest.manifests) {
            await new Promise((resolve) => setTimeout(resolve, 50))
            const manifest = await this.getManifest(m.digest)
            const configSize = manifest.config?.size || 0
            // console.log('configSize:', configSize)
            // noinspection JSUnresolvedReference
            const layerSize = manifest.layers?.reduce((a, l) => a + (l.size || 0), 0) || 0
            // console.log('layerSize:', layerSize)
            totalSize += configSize + layerSize
        }
        // console.log('totalSize:', totalSize)
        await cacheSet(key, totalSize, 60 * 60 * 4)
        return totalSize
    }

    /**
     * Get Image Manifest
     * @return {Promise<Object>}
     */
    async getManifest(tag = 'latest') {
        const url = `${this.packageOwner}/${this.packageName}/manifests/${tag}`
        // console.log('url:', url)
        const response = await this.client.get(url)
        return response.data
    }

    // getAuth(packageOwner, packageName) {
    //     return Buffer.from(`v1:${packageOwner}/${packageName}:0`).toString('base64')
    // }
}

/**
 * Get VirusTotal Stats for a Release Asset
 * @param {import('express').Request} req
 * @return {Promise<Object>}
 */
export async function getVTReleaseStats(req) {
    const tag = req.params.tag || 'latest'
    const key = `${req.params.owner}/${req.params.repo}/${req.params.asset}/${tag}`
    console.log('key:', key)
    // NOTE: Duplicate Code - 5 lines
    const cached = await cacheGet(key)
    if (cached) {
        if (cached.errorMessage) throw new Error(cached.errorMessage)
        return cached
    }
    console.log(`-- CACHE MISS: ${key}`)

    const gh = new GitHubApi(process.env.GITHUB_TOKEN)
    let release
    if (tag === 'latest') {
        release = await gh.getLatestRelease(req.params.owner, req.params.repo)
    } else {
        release = await gh.getReleaseByTag(req.params.owner, req.params.repo, tag)
    }
    // console.log('release?.assets:', release?.assets)
    if (!release) await cacheError(key, 'Release Not Found')
    const asset = release.assets.find((a) => a.name === req.params.asset)
    // console.log('asset:', asset)
    if (!asset) await cacheError(key, 'Asset Not Found')
    // console.log('asset?.digest:', asset?.digest)
    if (!asset?.digest) await cacheError(key, 'Digest Not Found')
    const hash = asset.digest.split(':')[1]
    // console.log('hash:', hash)
    const stats = await getVTStats(hash)
    // console.log('last_analysis_stats:', stats)
    if (!stats) await cacheError(key, 'VT Stats Not Found')
    await cacheSet(key, stats)
    return stats
}

/**
 * Get VT Stats for a File ID/Hash
 * @param {String} hash
 * @return {Promise<Object>}
 */
export async function getVTStats(hash) {
    const key = `/vt/id/${hash}`
    console.log('key:', key)
    // NOTE: Duplicate Code - 5 lines
    const cached = await cacheGet(key)
    if (cached) {
        if (cached.errorMessage) throw new Error(cached.errorMessage)
        return cached
    }
    console.log(`-- CACHE MISS: ${key}`)
    const vt = new VTApi(process.env.VT_API_KEY)
    let stats
    if (hash.endsWith('==')) {
        console.log('DEPRECATED - getAnalysis') // TODO: Deprecated
        const data = await vt.getAnalysis(hash)
        // console.log('data:', JSON.stringify(data, null, 2))
        // noinspection JSUnresolvedReference
        stats = data?.data?.attributes?.stats
    } else {
        // console.log('getReport')
        const data = await vt.getReport(hash)
        // console.log('data:', JSON.stringify(data, null, 2))
        // noinspection JSUnresolvedReference
        stats = data?.data?.attributes?.last_analysis_stats
    }
    if (!stats) await cacheError(key, 'VT Stats Not Found')
    await cacheSet(key, stats, 60 * 60 * 48)
    return stats
}

/**
 * Get JSONPath for JSON/YAML
 * @param {import('express').Request} req
 * @return {Promise<String>}
 */
export async function getJSONPath(req) {
    const key = req.path
    const cached = await cacheGet(key)
    // console.log('cached:', cached)
    if (cached) return cached
    console.log(`-- CACHE MISS: ${key}`)

    const url = new URL(req.params.url)
    console.log('url.href:', url.href)

    const response = await fetch(url)
    // console.log('response:', response)
    // console.log('response.status:', response.status)

    // const length = response.headers.get('content-length')
    // console.log('content-length:', length)

    const text = await response.text()
    // console.log('text.length:', text.length)
    // const encoder = new TextEncoder().encode(text)
    // console.log('encoder.length:', encoder.length)

    let data
    if (req.params.type === 'yaml') {
        data = parse(text)
    } else {
        data = JSON.parse(text)
    }
    // console.log('data:', data)

    let result = jp.query(data, req.params.path)[0]
    console.log('result:', result)
    if (req.query.split) {
        const split = result.split(req.query.split)
        result = split[req.query.index || 0]
        console.log('result:', result)
    }
    if (!result) {
        throw new Error('No Result for Query')
    } else if (typeof result === 'object') {
        throw new TypeError('Object Result')
    } else {
        result = result.toString()
        await cacheSet(req.originalUrl, result)
        return result
    }
}

async function cacheGet(key) {
    // return cache.get(key)
    const cached = await client.get(key)
    return cached ? JSON.parse(cached) : null
}

async function cacheSet(key, value, EX = 60 * 60) {
    // cache.set(key, totalSize)
    await client.set(key, JSON.stringify(value), { EX })
}

export async function cacheDelete(key) {
    // cache.del(key, totalSize)
    return await client.del(key)
}

async function cacheError(key, errorMessage, EX = 60 * 10) {
    console.log(`cacheError: ${key}`, errorMessage)
    await cacheSet(key, { errorMessage }, EX)
    throw new Error(errorMessage)
}

export async function incrBadge() {
    if (!influxClient) return
    await client.incr('badges_total')
}

export async function sendInflux() {
    if (!influxClient) return console.log('InfluxDB Not Configured.')
    console.log(`Processing Influx: ${new Date().toLocaleString()}`)
    // NOTE: this logic can be split up...
    const data = await client.getDel('badges_total')
    console.log('client.getDel: data:', data)
    const value = JSON.parse(data) || 0
    console.log('JSON.parse: value:', value)

    const org = process.env.INFLUX_ORG || 'cssnr'
    const bucket = process.env.INFLUX_BUCKET || 'node-badges'
    const writeApi = influxClient.getWriteApi(org, bucket)
    // writeApi.useDefaultTags({ host: hostname() })

    const point = new Point('badges_total').intField('value', value)
    console.log('point:', point)
    writeApi.writePoint(point)
    writeApi
        .close()
        .then(() => console.log('writePoint successful.'))
        .catch((e) => console.error('writePoint error:', e))
}
