'use strict';

var fs       = require('fs');
var path     = require('path');

var globby   = require('globby');
var extend   = require('deep-extend');
var mkdirp   = require('mkdirp');
var chokidar = require('chokidar');

var Pleeease = require('pleeease');
var Logger   = require('../lib/logger');

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
var CLI = function (inputs, output) {

    inputs = (inputs === undefined || inputs.length === 0) ? undefined : inputs;
    output = (output === undefined || output === true) ? 'app.min.css' : output;

    var opts = this.extendConfig();

    this.pleeease = new Pleeease(opts);

    inputs = opts.in  || inputs;
    output = opts.out || output;

    if (this.pleeease.options.sourcemaps) {
        this.pleeease.options.sourcemaps.to = output;
    }

    if (inputs === undefined) {
        return new Logger.error('You must define inputs files');
    } else {
        this.files = this.getFiles(inputs, output);
    }

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
    var configFile = '.pleeeaserc';
    config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  } finally {
    return extend(opts, config);
  }

};

/**
 *
 * Get files from glob
 *
 */
CLI.prototype.getFiles = function (inputs, output) {

    var files = globby.sync(inputs);

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

    results = results.filter(function (result) {
        return result.match(/\.(css|scss|sass|less|styl)$/);
    });

    return {
        inputs: results,
        output: output
    };

};

/**
 *
 * Compile files, write processed CSS and map files if asked
 *
 */
CLI.prototype.compile = function (watched) {

    var inputs = this.files.inputs;
    var output = this.files.output;

    try {
        this._compile(inputs, output);
        if (watched) {
            return new Logger.success('Recompiled file ' + watched);
        } else {
            return new Logger.success('Compile ' + inputs.length + ' file(s) [' + inputs + '] to ' + output);
        }
    } catch (err) {
        return new Logger.error('Compilation error\n' + err);
    }

};

CLI.prototype._compile = function (inputs, output) {

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
        try {
            var fileAst = cli.pleeease.parse(filestring);
        } catch (err) {
            throw new Error(err, filename);
        }

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
    mkdirp.sync(path.dirname(output));

    var sourcemaps = cli.pleeease.options.sourcemaps;
    if (sourcemaps && sourcemaps.map && sourcemaps.map.inline === false) {
        fs.writeFileSync(output, fixed.css);
        fs.writeFileSync(output + '.map', fixed.map);
    } else {
        fs.writeFileSync(output, fixed);
    }

    this.fixed = fixed;
}

/**
 *
 * Compile and run watcher
 *
 */
CLI.prototype.watch = function (opts) {

    var cli = this;
    opts = opts || {};

    // compile first
    cli.compile();

    return cli.runWatcher(opts);

};

CLI.prototype.runWatcher = function (opts) {
    var cli = this;
    var output = this.files.output;

    opts.persistent = (opts.persistent === undefined) ? true : opts.persistent;
    opts.usePolling = true;
    opts.ignored = this.ignoredWatch(output);
    /**
     *
     * Watcher
     * - is `persistent`
     * - `usePolling` (needed for some text editors)
     * - ignore files that are not CSS and output file
     *    (we can't only use inputs because of imported files)
     */
    try {
        var watcher = chokidar.watch(['.'], opts);
            watcher.on('change', cli.changeDetected.bind(cli));
        Logger.log('Watcher is running...');
        return watcher;
    } catch (err) {
        throw err;
    }
};

CLI.prototype.ignoredWatch = function (output) {
    return function (path) {
        if (path === '.')    { return false; }
        if (path === output) { return true; }
        return (path.match(/\.(?!(css|scss|sass|less|styl))/));
    }
}

CLI.prototype.changeDetected = function (watched) {
    // when a change is detected, compile files
    this.compile(watched);
}

CLI.prototype.closeWatcher = function (watcher) {
    return watcher.close();
};

/**
 *
 * New CLI instance
 *
 */
var cli = function (inputs, output) {
    return new CLI(inputs, output);
};

/**
 *
 * Exports
 *
 */
module.exports = cli;