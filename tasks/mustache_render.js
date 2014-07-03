/**
 * grunt-mustache-render
 * https://github.com/5thWall/mustache-render
 *
 * Copyright (c) 2013 Andy Arminio
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function gruntTask(grunt) {
  var mustache = require("mustache"),
  path = require('path'),
  Promise = require('es6-promise').Promise,

  DEFAULT_OPTIONS = {
    directory : "",
    extension : ".mustache",
    prefix : "",
    clear_cache : false
  };

  /**
   * Public: Create Object for rendering templates
   *
   * options   - The Object options used to configure the renderer
   * directory - The String base directory to look for partials (default: "")
   * extension - The String extension for partials templates (default: ".mustache")
   * prefix    - The String common prefix for partials (default: "")
   */
  function GMR(options) {
    this.options = options(DEFAULT_OPTIONS);
  }

  /**
   * Public: Render a template with the given data to the given destination
   *
   * template - The String path to the template to be rendered
   * data     - The String path to a JSON or YAML file
   *            The data Object
   * dest     - The String path to write the rendered template
   *
   * Returns a Promise to be fulfilled once rendering completes, or rejected if
   * any error occurs while trying to render given the parameters.
   *
   * If the resolved data yields something that isn't an object, "non-object
   * data" will be displayed to the user in yellow as a warning.
   */
  GMR.prototype.render = function render(data, template, dest) {
    return new Promise(function renderPromise(resolve, reject) {
      Promise.all([this._getData(data), this._compileTemplate(template)]).

      then(function gotDataAndRenderFn(results) {
        var dataObj = results[0], renderFn = results[1];

        grunt.file.write(dest, renderFn(dataObj, this._getPartial.bind(this)));

        grunt.log.writeln("Output " + dest + ":");
        grunt.log.oklns(
          (
            typeof dataObj === 'object' ?
            (Object.keys(dataObj).length + " variables").green :
            "non-object data".yellow
          ) +
          " into " + template.cyan +
          " from " + (typeof data === 'string' ? data : "JavaScript code").cyan
        );

        resolve();
      }.bind(this)).

      catch(function errorFromDataOrRenderFn(exception) {
        grunt.log.writeln(dest + "... " + "ERROR".red);
        reject(exception);
      });
    }.bind(this));
  };

  // Internal: Ensure data is the proper format.
  // The check that was previously here to make sure the user ends up with an
  // object for their data has been moved to render() as there are other ways a
  // non-object could sneak in (e.g. reading odd "JSON" from a file or URL).
  GMR.prototype._getData = function getData(data) {
    return new Promise(function getDataPromise(resolve, reject) {
      if (data === undefined || data === null) {
        reject(new Error("Data must be defined and not null"));
      } else if (typeof data !== 'string') {
        resolve(data);
      } else if (/^https?:/.test(data)) {
        resolve(this._getDataFromUrl(data));
      } else {
        resolve(this._getDataFromFile(data));
      }
    }.bind(this));
  };

  // Internal: Read JSON or YAML from a remote URL.
  GMR.prototype._getDataFromUrl = function getDataFromUrl(dataUrl) {
    throw new Error("Remote data lookups are not implemented yet.");
  };

  // Internal: Read JSON or YAML data from file.
  GMR.prototype._getDataFromFile = function getDataFromFile(dataPath) {
    if (/\.json/i.test(dataPath)) {
      return grunt.file.readJSON(dataPath);
    } else if (/\.ya?ml/i.test(dataPath)) {
      return grunt.file.readYAML(dataPath);
    }

    throw new Error("Data file must be JSON or YAML. Given: " + dataPath);
  };

  // Internal: Compile template to render function.
  GMR.prototype._compileTemplate = function compileTemplate(file) {
    return mustache.compile(grunt.file.read(file));
  };

  // Internal: Delegate to user provided function if present
  GMR.prototype._getPartial = function getPartial(name) {
    if(this.options.partial_finder) {
      return this.options.partial_finder(name);
    }

    return this._defaultGetPartial(name);
  };

  // Internal: Retrieve String partial by name.
  GMR.prototype._defaultGetPartial = function defaultGetPartial(name) {
    var fileName = this.options.prefix + name + this.options.extension;
    var filePath = path.join(this.options.directory, fileName);

    if (grunt.file.exists(filePath)) {
      return grunt.file.read(filePath);
    }

    return "";
  };

  grunt.registerMultiTask('mustache_render', 'Render mustache templates',
    function registerTask() {
      var done = this.async();
      var renderer = new GMR(this.options);

      if (renderer.options.clear_cache) { mustache.clearCache(); }

      Promise.all(this.files.map(function renderFile(fileData) {
        return renderer.render(fileData.data, fileData.template, fileData.dest);
      })).

      then(function allFulfilled() {
        grunt.log.writeln();
        grunt.log.oklns("Files successfully written: " + this.files.length);
        done();
      }.bind(this)).

      catch(function someRejected(exception) {
        if (exception && typeof exception.stack === 'string') {
          exception.stack.
            split('\n').
            filter(Boolean).
            forEach(function logErrorLine(line) { grunt.log.error(line); });
        }
        done(false);
      });
  });
};
