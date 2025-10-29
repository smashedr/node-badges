import axios from 'axios'
import createDebug from 'debug'

const debug = createDebug('app:api')

export class VTApi {
    /**
     * GitHub Api
     * @param {string} token
     */
    constructor(token) {
        this.client = axios.create({
            baseURL: 'https://www.virustotal.com/api/v3/',
            headers: { 'X-APIKey': token },
        })
    }

    /**
     * Get Release
     * @param {string} id
     * @return {Promise<object|undefined>}
     */
    async getReport(id) {
        try {
            const response = await this.client.get(`/files/${id}`)
            debug('getReport: response.status:', response.status)
            return response.data
        } catch (error) {
            console.error('error:', error)
        }
    }

    /**
     * Get Release
     * @param {string} id
     * @return {Promise<object|undefined>}
     */
    async getAnalysis(id) {
        try {
            const response = await this.client.get(`/analyses/${id}`)
            debug('getReport: response.status:', response.status)
            return response.data
        } catch (error) {
            console.error('error:', error)
        }
    }
}
