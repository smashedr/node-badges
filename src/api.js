import axios from 'axios'
// noinspection JSUnresolvedReference
import { Buffer } from 'node:buffer'
import { createClient } from 'redis'

// const NodeCache = require('node-cache')
// const cache = new NodeCache({ stdTTL: 60 * 60 })

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379'
console.log('Connecting to Redis:', redisUrl)
const client = createClient({ url: redisUrl })
await client.connect()

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
        console.log('url:', url)
        const cached = await cacheGet(`ghcr/tags/${url}`)
        console.log('cached:', cached)
        if (cached) return cached
        console.log(`REQUEST NOT CACHED: ghcr/tags/${url}`)

        const response = await this.client.get(url)
        await cacheSet(`ghcr/tags/${url}`, response.data.tags)
        return response.data.tags
    }

    /**
     * Get Image Size
     * @return {Promise<Number>}
     */
    async getImageSize(tag = 'latest') {
        const key = `ghcr/size/${this.packageOwner}/${this.packageName}/${tag}`
        // const cached = cache.get(key)
        const cached = await cacheGet(key)
        console.log('cached:', cached)
        if (cached) return cached
        console.log(`REQUEST NOT CACHED: ${key}`)

        const indexManifest = await this.getManifest(tag)
        // console.log('indexManifest:', indexManifest)
        let totalSize = 0
        // noinspection JSUnresolvedReference
        for (const m of indexManifest.manifests) {
            await new Promise((resolve) => setTimeout(resolve, 50))
            const manifest = await this.getManifest(m.digest)
            const configSize = manifest.config?.size || 0
            console.log('configSize:', configSize)
            // noinspection JSUnresolvedReference
            const layerSize = manifest.layers?.reduce((a, l) => a + (l.size || 0), 0) || 0
            console.log('layerSize:', layerSize)
            totalSize += configSize + layerSize
        }
        console.log('totalSize:', totalSize)
        // cache.set(key, totalSize)
        await cacheSet(key, totalSize)
        return totalSize
    }

    /**
     * Get Image Manifest
     * @return {Promise<Object>}
     */
    async getManifest(tag = 'latest') {
        const url = `${this.packageOwner}/${this.packageName}/manifests/${tag}`
        console.log('url:', url)
        const response = await this.client.get(url)
        return response.data
    }

    // getAuth(packageOwner, packageName) {
    //     return Buffer.from(`v1:${packageOwner}/${packageName}:0`).toString('base64')
    // }
}

async function cacheGet(key) {
    const cached = await client.get(key)
    return cached ? JSON.parse(cached) : null
}

async function cacheSet(key, value, EX = 60 * 60) {
    await client.set(key, JSON.stringify(value), { EX })
}
