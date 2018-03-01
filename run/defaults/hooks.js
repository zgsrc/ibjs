module.exports = {
    async config(config) {
        /* Modify config after it has been loaded */
    },    
    async context(context) {
        /* Modify context after it has been setup */
    },
    async ready(session, context) {
        /* Called after all initialization has completed */
    },
    afterReplay(session, context) { 
        /* Called after all events have been replayed from a file */
    },
    sigint(session, context) { 
        /* Called if the process receives as SIGINT message */
        session.close()
    },
    exit(session, context) {
        /* Called if the process receives an 'exit' events from the terminal */
        session.close()
    },
    warning(msg) {
        /* Handles warnings */
        console.warn(msg)
    },
    error(err) {
        /* Handles errors */
        console.error(err)
    }
}