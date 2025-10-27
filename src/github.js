import createDebug from 'debug'
import { Octokit } from '@octokit/rest'

export const debug = createDebug('app:api')

export class GitHubApi {
    /**
     * GitHub Api
     * @param {String} [token]
     */
    constructor(token) {
        const data = {}
        if (token) data.token = token
        this.octokit = new Octokit(data)
    }

    // /**
    //  * Get Release
    //  * @param {string} release_id
    //  * @return {Promise<Object>}
    //  */
    // async getRelease(release_id) {
    //     debug('getRelease:', release_id)
    //     const response = await this.octokit.rest.repos.getRelease({
    //         ...github.context.repo,
    //         release_id,
    //     })
    //     debug('response.status:', response.status)
    //     return response.data
    // }

    /**
     * Get Release by Tag
     * @param {String} owner
     * @param {String} repo
     * @param {String} tag
     * @return {Promise<Object>}
     */
    async getReleaseByTag(owner, repo, tag) {
        debug('getReleaseByTag:', tag)
        const response = await this.octokit.rest.repos.getReleaseByTag({
            owner,
            repo,
            tag,
        })
        debug('response.status:', response.status)
        return response.data
    }

    /**
     * Get Latest Release
     * @param {String} owner
     * @param {String} repo
     * @return {Promise<Object|Undefined>}
     */
    async getLatestRelease(owner, repo) {
        debug('getLatestRelease:', owner, repo)
        try {
            const response = await this.octokit.rest.repos.getLatestRelease({
                owner,
                repo,
            })
            debug('response.status:', response.status)
            return response.data
        } catch (error) {
            console.error('error:', error)
        }
    }
}
