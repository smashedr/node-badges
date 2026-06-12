import axios from 'axios'
import createDebug from 'debug'

const debug = createDebug('app:api')

export class VTApi {
  /**
   * VirusTotal API
   * @param {string} tokens - CSV of API tokens
   */
  constructor(tokens) {
    this.tokens = tokens
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    // debug('this.tokens:', this.tokens)
    console.log(`Loaded ${this.tokens.length} VT API Keys`)

    this.idx = 0

    this.client = axios.create({
      baseURL: 'https://www.virustotal.com/api/v3/',
    })

    this.client.interceptors.request.use((config) => {
      config.headers['X-APIKey'] = this.tokens[this.idx]
      this.idx = (this.idx + 1) % this.tokens.length
      debug('Using token index %d/%d', this.idx, this.tokens.length)
      return config
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
