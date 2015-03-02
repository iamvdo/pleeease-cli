'use strict';

var CLI      = require('../lib/cli');
var Pleeease = require('pleeease');
var Logger   = require('../lib/logger');

var fs         = require('fs'),
    path       = require('path'),
    exec       = require('child_process').exec,
    trim       = require('cli-color/trim');

var bin        = 'node ' + path.resolve(__dirname, '../bin/pleeease');
var readFile = function (filename) {
  return fs.readFileSync(filename, 'utf-8');
};
var removeFile = function (filename) {
  return fs.unlinkSync(filename);
};

var __dirname__ = 'test/cli/';
var __in__      = __dirname__ + 'in.css';
var __out__     = __dirname__ + 'out';

/**
 *
 * Describe CLI
 *
 */
describe('CLI', function () {

  var out = __out__;
  var cli, options, remove;

  beforeEach(function() {
    cli     = new CLI();
    remove  = true;
  });

  afterEach(function() {
    if (remove) {
      removeFile(out);
    }
  });

  it('stores pleeease object', function() {
    var processor = new Pleeease();
    cli.pleeease.should.be.eql(processor);
    remove = false;
  });

  it('reads from input file and write to output file', function(done) {
    exec(bin + ' compile '+ __in__ + ' to '+ __out__, function (err, stdout) {
      if (err) return done(err);
      var input  = readFile(__in__);
      var output = readFile(__out__);
      output.should.be.eql(input);
      done();
    });
  });

  it('reads directory of inputs files and write to output file', function(done) {
    exec(bin + ' compile test/cli to '+ __out__, function (err, stdout) {
      if (err) return done(err);
      // there's only one file in test/cli, so read it
      var input  = readFile(__in__);
      var output = readFile(__out__);
      output.should.be.eql(input);
      done();
    });
  });

  it('reads from input file and write to default output file if omitted', function(done) {
    exec(bin + ' compile '+ __in__, function (err, stdout) {
      if (err) return done(err);
      var input  = readFile(__in__);
      var output = readFile(cli.defaults.out);
      output.should.be.eql(input);
      // remove default output file
      out = cli.defaults.out;
      done();
    });
  });

  it('reads from .pleeeaserc file if input and/or output files are omitted', function(done) {
    // create a .pleeeaserc file
    var json = '{"in": ["in.css"], "out": "out"}';
    var pleeeaseRC = fs.writeFileSync(__dirname__ + '.pleeeaserc', json);
    exec('cd ' + __dirname__ + ' && node ../../bin/pleeease compile', function (err, stdout) {
      if (err) return done(err);
      var input  = readFile(__in__);
      var output = readFile(__out__);
      output.should.be.eql(input);
      // remove .pleeeaserc file
      removeFile(__dirname__ + '.pleeeaserc');
      // remove output file
      out = __out__;
      done();
    });
  });

  it('writes sourcemaps', function (done) {
    // create a .pleeeaserc file
    var json = '{"in": ["in.css"], "out": "out", "sourcemaps": {"map": {"inline": false}}}';
    var pleeeaseRC = fs.writeFileSync(__dirname__ + '.pleeeaserc', json);
    exec('cd ' + __dirname__ + ' && node ../../bin/pleeease compile', function (err, stdout) {
      if (err) return done(err);
      var output = readFile(__out__ + '.map');
      output.should.be.ok;
      // remove .pleeeaserc file
      removeFile(__dirname__ + '.pleeeaserc');
      // remove sourcemaps
      removeFile(__out__ + '.map');
      // remove output file
      out = __out__;
      done();
    });
  });

  it('returns error when no files are found', function (done) {
    remove = false;
    exec(bin + ' compile ' + __dirname__ + 'not-found.css', function (err, stdout, stderr) {
      (trim(stdout).indexOf('File(s) not found') !== -1).should.be.true;
      done();
      }
    );
  });

  it('returns success message when compile', function (done) {
    exec(bin + ' compile '+ __in__ + ' to '+ __out__, function (err, stdout) {
      if (err) return done(err);
      (trim(stdout).search(/^Pleeease Compile [0-9]+ file/) !== -1).should.be.true;
      done();
    });
  });

});