'use strict';

var fs   = require('fs');
var path = require('path');

var chai   = require('chai');
var sinon  = require('sinon');
chai.should();
chai.use(require("sinon-chai"));

var CLI = require('../lib/cli');

// change cwd
process.chdir('./test/cli');

describe('cli', function () {

  var cli, stub;
  var readFile = function (filename) {
    return fs.readFileSync(filename, 'utf-8');
  };
  var removeFile = function (filename) {
    return fs.unlinkSync(filename);
  };

  beforeEach(function () {
  });

  afterEach(function () {
  });

  function waitFor (spies, fn) {
    function isSpyReady (spy) {
      return Array.isArray(spy) ? spy[0].callCount >= spy[1] : spy.callCount;
    }
    function finish () {
      clearInterval(interval);
      clearTimeout(to);
      fn();
    }
    var interval = setInterval(function() {
      if (spies.every(isSpyReady)) finish();
    }, 5);
    var to = setTimeout(finish, 1500);
  }

  it('returns error when no inputs files', function () {
    sinon.stub(console, 'log');
    try {
      var cli = new CLI();
      console.log.should.have.been.calledOnce;
      console.log.should.have.been.calledWithMatch('You must define inputs files');
      console.log.restore();
    } catch (err) {
      console.log.restore();
      throw err;
    }
  });

  it('get files', function () {
    cli = new CLI('in.css', 'out.css');
    cli.files.inputs.should.eql(['in.css']);
    cli.files.output.should.eql('out.css');
  });

  it('get files, using default output', function () {
    cli = new CLI('in.css');
    cli.files.should.be.an.instanceOf(Object);
    cli.files.inputs.should.eql(['in.css']);
    cli.files.output.should.eql('app.min.css');
  });

  it('get globby files', function () {
    cli = new CLI('*.css');
    cli.files.inputs.should.eql(['in.css', 'in2.css']);
  });

  it('get files in directory', function () {
    cli = new CLI('dir');
    cli.files.inputs.should.eql(['dir/in.css']);
  });

  it('extends files from .pleeeaserc', function () {
    var json = '{"in": "in.css", "out": "out.css"}';
    fs.writeFileSync('.pleeeaserc', json);

    // no files in CLI
    cli = new CLI();
    cli.files.inputs.should.eql(['in.css']);
    cli.files.output.should.eql('out.css');

    // files in CLI
    cli = new CLI('a.css', 'b.css');
    cli.files.inputs.should.eql(['in.css']);
    cli.files.output.should.eql('out.css');

    fs.unlinkSync('.pleeeaserc');
  });

  it('extends array of files from .pleeeaserc', function () {
    var json = '{"in": ["in.css", "in2.css"], "out": "out.css"}';
    fs.writeFileSync('.pleeeaserc', json);

    // no files in CLI
    cli = new CLI();
    cli.files.inputs.should.eql(['in.css', 'in2.css']);
    cli.files.output.should.eql('out.css');

    // files in CLI
    cli = new CLI('a.css', 'b.css');
    cli.files.inputs.should.eql(['in.css', 'in2.css']);
    cli.files.output.should.eql('out.css');

    fs.unlinkSync('.pleeeaserc');
  });

  it('copies output file in sourcemaps.to', function () {
    var json = '{"sourcemaps": true}';
    fs.writeFileSync('.pleeeaserc', json);

    // files in CLI
    cli = new CLI('in.css', 'out.css');
    cli.pleeease.options.sourcemaps.to.should.eql('out.css');

    fs.unlinkSync('.pleeeaserc');
  });

  it('creates Pleeease options', function () {
    var cli = new CLI('in.css');
    cli.pleeease.options.should.be.ok;
  });

  it('extends options from .pleeeaserc', function () {
    var json = '{"minifier": false, "rem": {"rootValue": "10px"}}';
    fs.writeFileSync('.pleeeaserc', json);

    cli = new CLI('in.css');
    cli.pleeease.options.minifier.should.eql(false);
    cli.pleeease.options.rem.should.eql({rootValue: "10px"});

    fs.unlinkSync('.pleeeaserc');
  });

  it('returns error when file is not found', function () {
    sinon.stub(console, 'log');
    try {
      var cli = new CLI('a.css');
      console.log.should.have.been.calledOnce;
      console.log.should.have.been.calledWithMatch('File(s) not found');
      console.log.restore();
    } catch (err) {
      console.log.restore();
      throw err;
    }
  });

  describe('#compile', function () {

    var remove;

    beforeEach(function () {
      remove = true;
      sinon.stub(console, 'log');
    });
    afterEach(function () {
      if (remove) {
        removeFile('app.min.css');
      }
      cli.compile.restore();
    });

    it('compiles', function (done) {
      cli = new CLI('in.css');
      sinon.spy(cli, 'compile');
      var p = Promise.resolve(cli)
        .then(function (r) {
          cli.compile();
          return cli._compile(cli.files.inputs, cli.files.output);
        })
        .then(function (result) {
          result.should.be.eql('.in{color:#FFF}');
          console.log.should.have.been.calledOnce;
          console.log.should.have.been.calledWithMatch('Compile 1 file(s) [in.css] to app.min.css');
          console.log.restore();
          done();
        })
        .catch(function (err) {
          console.log.restore();
          throw err;
        })
        .catch(done);
    });

    it('compiles multiple', function (done) {
      cli = new CLI(['in.css', 'in2.css']);
      sinon.spy(cli, 'compile');
      var p = Promise.resolve(cli)
        .then(function (r) {
          cli.compile();
          return cli._compile(cli.files.inputs, cli.files.output);
        })
        .then(function (result) {
          result.should.be.eql('.in{color:#FFF}.in2{color:#000}');
          console.log.should.have.been.calledOnce;
          console.log.should.have.been.calledWithMatch('Compile 2 file(s) [in.css,in2.css] to app.min.css');
          console.log.restore();
          done();
        })
        .catch(function (err) {
          console.log.restore();
          throw err;
        })
        .catch(done);
    });

    it('compiles one specific file (watched)', function () {
      cli = new CLI('in.css');
      sinon.spy(cli, 'compile');
      try {
        cli.compile('in.css');
        console.log.should.have.been.calledOnce;
        console.log.firstCall.should.have.been.calledWithMatch('Recompiled file in.css');
        console.log.restore();
      } catch (err) {
        console.log.restore();
        throw err;
      }
    });

    it('log errors when compile', function () {
      remove = false;
      cli = new CLI('error/error.css');
      sinon.spy(cli, 'compile');
      try {
        cli.compile();
        console.log.should.have.been.calledOnce;
        console.log.should.have.been.calledWithMatch('Compilation error');
        console.log.restore();
      } catch (err) {
        console.log.restore();
        throw err;
      }
    });

  });

  describe('#watch', function () {
    var watcher;
    beforeEach(function () {
      sinon.stub(console, 'log');
    });
    afterEach(function () {
      removeFile('app.min.css');
      cli.watch.restore();
      cli.compile.restore();
      cli.closeWatcher(watcher);
    });

    it('watches', function () {
      cli = new CLI('in.css');
      sinon.spy(cli, 'watch');
      sinon.spy(cli, 'compile');
      try {
        watcher = cli.watch({persistent: false});
        cli.compile.should.have.been.calledOnce;
        console.log.should.have.been.calledTwice;
        console.log.firstCall.should.have.been.calledWithMatch('Compile 1 file(s) [in.css] to app.min.css');
        console.log.secondCall.should.have.been.calledWithMatch('Watcher is running...');
        console.log.restore();
      } catch (err) {
        console.log.restore();
        throw err;
      }
    });

  });

  describe('#ignoredWatch', function () {

    it('ignores files', function () {
      cli = new CLI('*.css');
      var ignored = cli.ignoredWatch('out.css');
      // not ignored
      (ignored('in.css') === null).should.be.ok;
      (ignored('in.scss') === null).should.be.ok;
      (ignored('in.less') === null).should.be.ok;
      (ignored('in.styl') === null).should.be.ok;
      (ignored('_in.css') === null).should.be.ok;
      (ignored('dir/in.css') === null).should.be.ok;
      // ignored
      (ignored('out.css') === null).should.not.be.ok;
      (ignored('.pleeeaserc') === null).should.not.be.ok;
      (ignored('file.txt') === null).should.not.be.ok;
      (ignored('file.css.txt') === null).should.not.be.ok;
    });

  });

  describe('real use-cases', function () {

    var bin  = 'node ' + path.resolve(__dirname, '../bin/pleeease');
    var exec = require('child_process').exec;
    var trim = require('cli-color/trim');
    var input   = 'in.css';
    var input2  = 'in2.css';
    var output  = 'out';
    var defaultOutput = 'app.min.css';

    var remove;

    // increase default timeout for these since travis can be slow
    this.timeout(3000);

    beforeEach(function() {
      remove = true;
    });

    afterEach(function() {
      if (remove) {
        removeFile(output);
      }
    });

    it('reads from input file and write to output file', function(done) {
      exec(bin + ' compile '+ input + ' to '+ output, function (err, stdout) {
        if (err) return done(err);
        var i = readFile(input);
        var o = readFile(output);
        o.should.be.eql(i);
        done();
      });
    });

    it('reads directory of inputs files and write to output file', function(done) {
      exec(bin + ' compile dir to '+ output, function (err, stdout) {
        if (err) return done(err);
        var i = readFile(input); // read only file (only one)
        var o = readFile(output);
        o.should.be.eql(i);
        done();
      });
    });

    it('reads from input file and write to default output file if omitted', function (done) {
      output = defaultOutput;
      exec(bin + ' compile '+ input, function (err, stdout) {
        if (err) return done(err);
        var i = readFile(input);
        var o = readFile(defaultOutput);
        o.should.be.eql(i);
        done();
      });
    });

    it('reads from .pleeeaserc file if input and/or output files are omitted', function (done) {
      output = 'out';
      // create a .pleeeaserc file
      var json = '{"in": ["in.css"], "out": "out"}';
      var pleeeaseRC = fs.writeFileSync('.pleeeaserc', json);
      exec(bin + ' compile', function (err, stdout) {
        if (err) return done(err);
        var i = readFile(input);
        var o = readFile(output);
        o.should.be.eql(i);
        // remove .pleeeaserc file
        removeFile('.pleeeaserc');
        done();
      });
    });

    it('writes sourcemaps file', function (done) {
      // create a .pleeeaserc file
      var json = '{"in": ["in.css"], "out": "out", "sourcemaps": {"map": {"inline": false}}}';
      var pleeeaseRC = fs.writeFileSync('.pleeeaserc', json);
      exec(bin + ' compile', function (err, stdout) {
        if (err) return done(err);
        var o = readFile(output + '.map');
        o.should.be.ok;
        // remove .pleeeaserc file
        removeFile('.pleeeaserc');
        // remove sourcemaps
        removeFile(output + '.map');
        done();
      });
    });

    it('gets from and to from cli', function (done) {
      // create a .pleeeaserc file
      var json = '{"sourcemaps": {"map": {"inline": false}}}';
      var pleeeaseRC = fs.writeFileSync('.pleeeaserc', json);
      exec(bin + ' compile in.css to out', function (err, stdout) {
        if (err) return done(err);
        var o = readFile(output + '.map');
        o.should.be.ok;
        // remove .pleeeaserc file
        removeFile('.pleeeaserc');
        // remove sourcemaps
        removeFile(output + '.map');
        done();
      });
    });

    it('returns error when no files are found', function (done) {
      remove = false;
      exec(bin + ' compile not-found.css', function (err, stdout, stderr) {
        (trim(stdout).indexOf('File(s) not found') !== -1).should.be.true;
        done();
        }
      );
    });

    it('returns success message when compile', function (done) {
      exec(bin + ' compile ' + input + ' to '+ output, function (err, stdout) {
        if (err) return done(err);
        (trim(stdout).search(/^Pleeease Compile [0-9]+ file/) !== -1).should.be.true;
        done();
      });
    });

  });

});
