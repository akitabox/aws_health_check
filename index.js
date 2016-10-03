var fs = require('fs');
var async = require('async');
var parseUrl = require('parseurl');
var _ = require('underscore');

module.exports = healthCheck;

/**
 * Express middleware handling AWS Route53 or ELB health check requests. Optionally verifies the existence of local
 * paths in determining application 'healthiness'.
 *
 * @param [options] {Object}                         - optional configuration object
 * @param [options.path=/heartbeat] {String}         - health check url
 * @param [options.requiredLocalPaths=[]] {[String]} - array of local paths that must exist for the application to be 'healthy'
 * @param [options.debug=false] {Boolean}            - will console.log() debug messages if set to true
 * @returns {Function} Returns Express middleware
 */
function healthCheck(options) {
    if (!_.isObject(options)) {
        options = {};
    }

    function log(data) {
        if (_.isBoolean(options.debug) && options.debug) {
            console.log(data);
        }
    }

    if (!_.isString(options.path) || !options.path.length || !/^\//.test(options.path)) {
        options.path = '/heartbeat';
        log('Using default health check route: ' + options.path);
    }

    if (!_.isArray(options.requiredLocalPaths)) {
        options.requiredLocalPaths = [];
        log('Not verifying any local paths during health checks');
    }

    return function heartbeat(req, res, next) {
        if (parseUrl(req).pathname !== options.path) {
            return next();
        } else if (req.method !== 'GET') {
            log('Health check requests should have method GET');
            return res.sendStatus(405);
        }

        if (_.isEmpty(options.requiredLocalPaths)) {
            // Just send 200 if there are no local application paths to verify
            return res.sendStatus(200);
        }

        // Verify that each of the required paths exist at the time of the health check request
        async.each(
            options.requiredLocalPaths,
            function (requiredLocalPath, eachCb) {
                fs.stat(requiredLocalPath, function(err, stats) {
                    if (err) {
                        log('Health Check Failed: Invalid local path ' + requiredLocalPath);
                    }
                    return eachCb(err);
                });
            },
            function(err) {
                if (err) return next(err);
                log('Health Check Passed');
                return res.sendStatus(200);
            }
        )
    }
}