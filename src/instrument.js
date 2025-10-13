if (process.env.SENTRY_URL) {
    const environment = process.env.SENTRY_ENVIRONMENT || 'dev'
    console.log(`SENTRY_ENVIRONMENT: ${environment}`)
    console.log(`SENTRY_URL: ${process.env.SENTRY_URL.substring(0, 14)}...`)
    const Sentry = await import('@sentry/node')
    // https://docs.sentry.io/platforms/javascript/configuration/options/
    Sentry.init({
        dsn: process.env.SENTRY_URL,
        environment,
    })
} else {
    console.log('SENTRY_URL: MISSING')
}
