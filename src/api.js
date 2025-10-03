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
            console.log('indexManifest - !list + !index:', indexManifest)
            const size = indexManifest.layers.reduce((sum, layer) => sum + layer.size, 0)
            totalSize = size + (indexManifest.config.size || 0)
            console.log('totalSize:', totalSize)
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
        console.log('totalSize:', totalSize)
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
    // return cache.get(key)
    const cached = await client.get(key)
    return cached ? JSON.parse(cached) : null
}

async function cacheSet(key, value, EX = 60 * 60) {
    // cache.set(key, totalSize)
    await client.set(key, JSON.stringify(value), { EX })
}
