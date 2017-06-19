let fs = require('fs');
let async = require('async');
let parseUrl = require('parseurl');
let _ = require('underscore');

// Whether or not this instance is healthy determines the
// responses sent.
let isHealthy = true;

/**
 * Set the healthiness of this instance.
 *
 * @param status {Boolean}  `true` for healthy, `false` for unhealthy.
 * @returns {undefined}
 */
function setHealthy(status) {
    isHealthy = status;
}

/**
 * Express middleware handling AWS Route53 or ELB health check requests.
 * Optionally verifies the existence of local paths in determining
 * application 'healthiness'.
 *
 * @param [options] {Object}    optional configuration object
 * @param [options.path=/heartbeat] {String}    health check url
 * @param [options.requiredLocalPaths=[]] {[String]}
 *          Array of local paths that must exist for the application to
 *          be 'healthy'. If this is either undefined or an empty array,
 *          default to value set by setHealthy.
 * @param [options.debug=false] {Boolean}   
 *          Will console.log() debug messages if set to true
 * @returns {Function} Returns Express middleware
 */
function healthCheck(options = {}) {
    function log(data) {
        if (!_.isBoolean(options.debug) || !options.debug) return;
        console.log(data);
    }

    // Allow for custom routes
    if (!_.isString(options.path) ||
        !options.path.length ||
        !options.path.startsWith('/')) {
        options.path = '/heartbeat';
        log('Using default health check route: ' + options.path);
    }

    if (!_.isArray(options.requiredLocalPaths)) {
        options.requiredLocalPaths = [];
        log('Not verifying any local paths during health checks');
    }

    return function heartbeat(req, res, next) {
        if (options.requiredLocalPaths.length == 0) {
            return res.sendStatus(isHealthy ? 200 : 503);
        }

        if (parseUrl(req).pathname !== options.path) {
            return next();
        } else if (req.method !== 'GET') {
            log('Health check requests should have method GET');
            return res.sendStatus(405);
        }

        // Verify that each of the required paths exist at the time of
        // the health check request
        async.each(
            options.requiredLocalPaths,
            function (requiredLocalPath, eachCb) {
                fs.stat(requiredLocalPath, function (err, stats) {
                    if (err) {
                        log('Health Check Failed: ' +
                            'Invalid local path ' + requiredLocalPath);
                    }
                    return eachCb(err);
                });
            },
            function (err) {
                if (err) return next(err);
                return res.sendStatus(200);
            }
        );
    };
}

module.exports = {
    middleware : healthCheck,
    setHealthy : setHealthy
};
