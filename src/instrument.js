if (process.env.SENTRY_URL) {
    const environment = process.env.SENTRY_ENVIRONMENT || 'dev'
    console.log(`SENTRY_ENVIRONMENT: ${environment}`)
    console.log(`SENTRY_URL: ${process.env.SENTRY_URL.substring(0, 16)}...`)
    const Sentry = await import('@sentry/node')
    Sentry.init({
        dsn: process.env.SENTRY_URL,
        sendDefaultPii: true,
        environment,
    })
} else {
    console.log('SENTRY_URL: MISSING')
}
