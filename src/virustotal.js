import axios from 'axios'
import createDebug from 'debug'

const debug = createDebug('app:api')

export class VTApi {
    /**
     * GitHub Api
     * @param {String} token
     */
    constructor(token) {
        this.client = axios.create({
            baseURL: 'https://www.virustotal.com/api/v3/',
            headers: { 'X-APIKey': token },
        })
    }

    /**
     * Get Release
     * @param {String} id
     * @return {Promise<Object|Undefined>}
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
     * @param {String} id
     * @return {Promise<Object|Undefined>}
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
