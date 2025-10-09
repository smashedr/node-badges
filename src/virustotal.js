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
     * @param {string} id
     * @return {Promise<Object>}
     */
    async getReport(id) {
        const response = await this.client.get(`/files/${id}`)
        console.log('getReport: response.status:', response.status)
        return response.data
    }
}
