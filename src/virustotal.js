import axios from 'axios'

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
            console.log('getReport: response.status:', response.status)
            return response.data
        } catch (error) {
            console.log('error:', error)
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
            console.log('getReport: response.status:', response.status)
            return response.data
        } catch (error) {
            console.log('error:', error)
        }
    }
}
