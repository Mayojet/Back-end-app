/*
 * Connect all of your endpoints together here.
 */
module.exports = function (app, router) {
    // Import route modules
    var home = require('./home');
    var users = require('./users');
    var tasks = require('./tasks');

    // Use route modules
    home(router);
    users(router);
    tasks(router);

    // Register the router with /api prefix
    app.use('/api', router);
};
