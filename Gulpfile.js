var gulp        = require('gulp');

/**
 *
 * Lint JS files
 * lint:lib, lint:tests and lint
 *
 */
gulp.task('lint:lib', function() {
    var jshint = require('gulp-jshint');

    gulp.src(['bin/**/*.js', 'lib/**/*.js'])
        .pipe(jshint())
        .pipe(jshint.reporter('jshint-stylish'));
});
gulp.task('lint:tests', function() {
    var jshint = require('gulp-jshint');

    gulp.src(['tests/**/*.js'])
        .pipe(jshint())
        .pipe(jshint.reporter('jshint-stylish'));
});
gulp.task('lint', ['lint:lib', 'lint:tests']);

/**
 *
 * Test spec
 * `npm test` (without argv)
 * `gulp test --file cli` (test only cli.js file)
 *
 */
gulp.task('test', function () {
    var mocha = require('gulp-mocha');
    var args = require('yargs').argv;
    var file = args.file || '*';

    return gulp.src('test/' + file + '.js', {read: false})
          .pipe(mocha({reporter: 'spec'}));
});

/**
 *
 * Bump version
 * gulp bump --type <patch, minor, major>
 *
 */
gulp.task('bump', function () {
    var bump = require('gulp-bump');
    var args = require('yargs').argv;

    return gulp.src('package.json')
            .pipe(bump({ type: args.type }))
            .pipe(gulp.dest('./'));

});