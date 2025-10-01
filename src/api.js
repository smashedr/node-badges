const axios = require('axios')
const { Buffer } = require('buffer')
const { createClient } = require('redis')

// const NodeCache = require('node-cache')
// const cache = new NodeCache({ stdTTL: 60 * 60 })

const client = createClient({ url: 'redis://redis:6379' })

client.connect().catch(console.error)

class Api {
    constructor(packageOwner, packageName) {
        this.packageOwner = packageOwner
        this.packageName = packageName
        this.token = Buffer.from(`v1:${packageOwner}/${packageName}:0`).toString('base64')
    }

    async getImageSize(tag = 'latest') {
        const key = `${this.packageOwner}/${this.packageName}/${tag}`
        // const cached = cache.get(key)
        const cached = await cacheGet(key)
        console.log('cached:', cached)
        if (cached) return cached
        console.log(`REQUEST NOT CACHED: ${key}`)

        const indexManifest = await this.getManifest(tag)
        let totalSize = 0
        // noinspection JSUnresolvedReference
        for (const m of indexManifest.manifests) {
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

    async getManifest(tag = 'latest') {
        const options = {
            headers: {
                accept: 'application/vnd.oci.image.index.v1+json,application/vnd.oci.image.manifest.v1+json',
                'x-github-api-version': '2022-11-28',
                authorization: `Bearer ${this.token}`,
            },
        }
        // console.log('options:', options)
        const url = `https://ghcr.io/v2/${this.packageOwner}/${this.packageName}/manifests/${tag}`
        console.log('url:', url)

        // noinspection JSCheckFunctionSignatures
        const response = await axios.get(url, options)
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

module.exports = { Api }
