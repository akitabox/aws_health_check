const fs = require('fs');
const async = require('async');
const parseUrl = require('parseurl');
const _ = require('underscore');
const HEARTBEAT_ROUTE = '/heartbeat';

// Whether or not this instance is healthy determines the
// responses sent.
let isHealthy = true;

module.exports = {
    middleware : healthCheck,
    setHealthyFlag,
    setHealthy,
    setUnhealthy
};

/**
 * Set the healthiness of this instance.
 *
 * @param status {Boolean}  `true` for healthy, `false` for unhealthy.
 * @returns {undefined}
 */
function setHealthyFlag(status) {
    isHealthy = status;
}
/**
 * Removed the isHealthy=false healthiness override and allows it to report itself as healthy.
 * Preferred over using setHealthyFlag when providing a callback to another service.
 */
function setHealthy() {
    isHealthy = true;
}
/**
 * Overrides the default healthiness and forces it to report unhealthy.
 * Preferred over using setHealthyFlag when providing a callback to another service.
 */
function setUnhealthy() {
    isHealthy = false;
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
 *          default to value set by setHealthyFlag.
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
    if (!_.isString(options.path) || !options.path.length || !options.path.startsWith('/')) {
        options.path = HEARTBEAT_ROUTE;
        log('Using default health check route: ' + options.path);
    }

    if (!_.isArray(options.requiredLocalPaths)) {
        options.requiredLocalPaths = [];
        log('Not verifying any local paths during health checks');
    }

    return function heartbeat(req, res, next) {
        if (parseUrl(req).pathname !== options.path) {
            return next(); // Did not match the /heartbeat route. Fall through.
        } else if (req.method !== 'GET') {
            log('Health check requests should have method GET');
            return res.sendStatus(405);
        }

        if (!isHealthy) {
            log("Health Check Failed because the application claims it isn't healthy.");
            return next(new Error());
        }

        if (options.requiredLocalPaths.length === 0) {
            return res.sendStatus(200);
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
