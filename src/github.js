import createDebug from 'debug'
import { Octokit } from '@octokit/rest'

export const debug = createDebug('app:api')

export class GitHubApi {
  /**
   * GitHub Api
   * @param {string} [token]
   */
  constructor(token) {
    const data = {}
    if (token) data.token = token
    this.octokit = new Octokit(data)
  }

  // /**
  //  * Get Release
  //  * @param {string} release_id
  //  * @return {Promise<object>}
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
   * @param {string} owner
   * @param {string} repo
   * @param {string} tag
   * @return {Promise<object>}
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
   * @param {string} owner
   * @param {string} repo
   * @return {Promise<object|undefined>}
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
