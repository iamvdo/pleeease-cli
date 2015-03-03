'use strict';

var Pleeease     = require('pleeease'),
    Logger       = require('../lib/logger');

var fs           = require('fs');
var path         = require('path');
var mkdirp       = require('mkdirp');
var extend       = require('deep-extend');
var chokidar     = require('chokidar');
var multiglob    = require('multi-glob');

/**
 *
 * Walk a path and return all files
 * @param  {String} dir     Directory to walk into
 * @return {Array}  results Array of files
 *
 */
var walk = function(dir) {
    var results = [];
    var list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            results.push(file);
        }
    });
    return results;
};

/**
 *
 * Constructor CLI
 *
 */
var CLI = function () {

    this.defaults = {
        'in' : '*.css',
        'out': 'app.min.css'
    };
    this.configFile = '.pleeeaserc';

    var opts = this.extendConfig();

    this.pleeease = new Pleeease(opts);

};

/**
 *
 * Extend config with .pleeeaserc
 *
 */
CLI.prototype.extendConfig = function (opts) {

  opts = opts || {};

  // read pleeeaserc
  var config = {};
  try {
    config = JSON.parse(fs.readFileSync(this.configFile, 'utf-8'));
  } finally {
    return extend(opts, config);
  }

};

/**
 *
 * Initialize CLI
 * Get the files, then call `compile` or `watch` method
 * @param  {String} fn     Name of method to call: `compile` or `watch`
 * @param  {Array}  inputs Array of input files or String
 * @param  {String} output Name of output file
 *
 */
CLI.prototype.init = function (fn, inputs, output) {

    var cli = this;

    inputs = this.pleeease.options.in  || this.pleeease.options.sourcemaps.from || inputs;
    output = this.pleeease.options.out || this.pleeease.options.sourcemaps.to   || output;

    multiglob.glob(inputs, function (err, files) {

        if (err) {
            throw err;
        }

        if (!files.length) {
            return new Logger.error('File(s) not found');
        }

        var results = [];

        // for each file / dir in arguments
        for (var i = 0; i < files.length; i++) {

            // if it's a directory
            if (fs.statSync(files[i]).isDirectory()) {
                // walk path and get all files
                results = results.concat(walk(files[i]));
            } else {
                // it's a file
                results.push(files[i]);
            }

        }

        // remove output from inputs
        if (results.indexOf(output) !== -1) {
            results.splice(results.indexOf(output), 1);
        }

        if ('compile' === fn) {

            cli.compile(results, output);

        } else if ('watch' === fn) {

            cli.watch(results, output);

        }

        // log
        return new Logger.success('Compile ' + results.length + ' file(s) [' + results + '] to ' + output);

    });

};

/**
 *
 * Compile all inputs files and write output file
 * @param  {Array}  inputs  Array of all inputs files
 * @param  {String} output  Name of output file
 *
 */
CLI.prototype.compile = function (inputs, output) {

    var cli = this;

    // create a new (future) Root AST
    var root;

    // get inputs files
    inputs.map(function(filename) {

        // read, parse and concatenate rules to Root AST
        var filestring = fs.readFileSync(filename, 'utf-8');
        if (cli.pleeease.options.sourcemaps) {
            cli.pleeease.options.sourcemaps.from = filename;
        }
        var fileAst = cli.pleeease.parse(filestring);

        // create the final AST
        if (root === undefined) {
            root = fileAst;
        } else {
            fileAst.each(function(rule) {
                root.append(rule.clone());
            });
        }

    });

    var fixed = cli.pleeease.process(root);

    // create directory if not exists
    mkdirp(path.dirname(output), function (err) {

        if (err) {
            console.log(err);
        }
        if (cli.pleeease.options.sourcemaps && cli.pleeease.options.sourcemaps.map.inline === false) {
            fs.writeFileSync(output, fixed.css);
            fs.writeFileSync(output + '.map', fixed.map);
        } else {
            fs.writeFileSync(output, fixed);
        }

    });

};

/**
 *
 * Watch all files, and write processed file when a change is detected
 * @param  {Array}  inputs  Array of all inputs files
 * @param  {String} output  Name of output file
 *
 */
CLI.prototype.watch = function (inputs, output) {

    var cli = this;

    // compile first
    cli.compile(inputs, output);

    // ignore all files that don't end with .css + output file
    var ignore = function (path) {
        return (path.match(/\.css$/) && path === output);
    };

    /**
     *
     * Watcher
     * - Watch `.` path
     * - Ignore `ignore` files
     * - Is `persistent`
     * - `usePolling` (needed for some text editors)
     *
     */
    var watcher = chokidar.watch(['.'], {ignored: ignore, persistent: true, usePolling: true});
        watcher
        .on('change', function(path) {

            // when a change is detected, compile files
            cli.compile(inputs, output);

            // log
            return new Logger.success('Recompiled file ' + path);

        });

    // log
    return new Logger.log('Watcher is running...');

};

/**
 *
 * New CLI instance
 *
 */
var cli = function() {
    return new CLI();
};

/**
 *
 * Exports
 *
 */
module.exports = cli;