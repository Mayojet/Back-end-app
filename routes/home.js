module.exports = function (router) {
    router.get('/', function (req, res) {
        res.status(200).json({
            message: "Welcome to Llama.io API",
            data: {}
        });
    });

    return router;
};
