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
     * Get Report
     * @param {string} id
     * @return {Promise<object|undefined>}
     */
    async getReport(id) {
        const response = await this.client.get(`/files/${id}`)
        debug('getReport: response.status:', response.status)
        return response.data
    }

    /**
     * Get Analysis
     * @param {string} id
     * @return {Promise<object|undefined>}
     */
    async getAnalysis(id) {
        const response = await this.client.get(`/analyses/${id}`)
        debug('getAnalysis: response.status:', response.status)
        return response.data
    }
}
