import { Octokit } from '@octokit/rest'

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
    //     console.log('getRelease:', release_id)
    //     const response = await this.octokit.rest.repos.getRelease({
    //         ...github.context.repo,
    //         release_id,
    //     })
    //     console.log('response.status:', response.status)
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
        console.log('getReleaseByTag:', tag)
        const response = await this.octokit.rest.repos.getReleaseByTag({
            owner,
            repo,
            tag,
        })
        console.log('response.status:', response.status)
        return response.data
    }

    /**
     * Get Latest Release
     * @param {String} owner
     * @param {String} repo
     * @return {Promise<Object|Undefined>}
     */
    async getLatestRelease(owner, repo) {
        console.log('getLatestRelease:', owner, repo)
        try {
            const response = await this.octokit.rest.repos.getLatestRelease({
                owner,
                repo,
            })
            console.log('response.status:', response.status)
            return response.data
        } catch (error) {
            console.log('error:', error)
        }
    }
}
