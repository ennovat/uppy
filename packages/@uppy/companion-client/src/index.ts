/**
 * Manages communications with Companion
 */

export { default as RequestClient } from './RequestClient.js'
export { default as Provider } from './Provider.js'
export { default as SearchProvider } from './SearchProvider.js'

export { default as getAllowedHosts } from './getAllowedHosts.js'

export * as tokenStorage from './tokenStorage.js'

export type { CompanionPluginOptions } from './CompanionPluginOptions.js'
