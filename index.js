'use strict';

var esmEs5 = require('esm-es5'),
    fs = require('fs'),
    Lifecycle = require('amodro-lifecycle/lifecycle-node'),
    // Lifecycle = require('amodro-lifecycle/lifecycle-node-debug'),
    // NativeModule = require('native_module'),
    Module = require('module'),
    path = require('path');

var hasOwn = Object.prototype.hasOwnProperty;
function hasProp(obj, prop) {
    return hasOwn.call(obj, prop);
}

// From node's module.js
function stripBOM(content) {
  // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
  // because the buffer-to-string conversion in `fs.readFileSync()`
  // translates it to FEFF, the UTF-16 BOM.
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

var lcProto = Lifecycle.prototype;
var oldSetModule = lcProto.setModule;

var protoMethods = {
  // START lifecycle overrides
  normalize: function(id, refId) {
    var parent = null;
    if (refId) {
      parent = new Module(refId);
      parent.filename = refId;
      parent.paths = Module._nodeModulePaths(path.dirname(refId));
    }

    var normalizedId = Module._resolveFilename(id, parent);

    return normalizedId;
  },

  locate: function(normalizedId, suggestedExtension) {
    return normalizedId;
  },

  fetch: function(normalizedId, refId, location) {
    var value;
    // If already in traditional cache or internal module, done processing.
    value = Module._cache[normalizedId];

    // if (!value && NativeModule.nonInternalExists(normalizedId)) {
    //   value = NativeModule.require(normalizedId);
    // }

    if (!value) {
      var source = stripBOM(fs.readFileSync(location, 'utf8')),
          esmResult = esmEs5(source);

      if (!esmResult.translated) {
        // Traditional load.
        var refModule = new Module(refId);
        refModule.filename = refId;
        refModule.paths = Module._nodeModulePaths(path.dirname(refId));
        value = Module._load(normalizedId, refId ? refModule : null);
      } else {
        this.translated[normalizedId] = esmResult;
        this.esType[normalizedId] = true;
      }
    }

    // Update module cache for this loader, to skip this work next time.
    if (value) {
      this.setModule(normalizedId, value);
    }

    this.addToRegistry(normalizedId,
                       this.translated[normalizedId].depIds);
  },

  translate: function(normalizedId, location, source) {
    // No need to do work here. Revisit when looking at loader plugins.
  },

  depend: function(normalizedId, deps) {
    // No plugin support yet, so just return deps.
    return deps;
  },

  evaluate: function(normalizedId, location, source) {
    // The result of this should be something in the registry.
  },

  instantiate: function(normalizedId, normalizedDeps, factory) {
    var esmResult = this.translated[normalizedId];
    delete this.translated[normalizedId];

    // This could be a fancier, native ES loader assisted process, but since
    // the source has already been transformed to es5 syntax, then leverage
    // traditional system to do the load, allows for debug breakpoints then
    // too.

    var mod = new Module(normalizedId);
    mod.filename = normalizedId;
    mod.paths = Module._nodeModulePaths(path.dirname(normalizedId));

    mod._compile(esmResult.source, normalizedId);

    return mod.exports;
  },


  setModule: function(normalizedId, value, isTemp) {
    var result = oldSetModule.apply(this, arguments);

    // Seed traditional cache so that the traditional calls backins instantiate
    // work correctly.
    if (!isTemp) {
      var mod = new Module(normalizedId);
      mod.filename = normalizedId;
      mod.paths = Module._nodeModulePaths(path.dirname(normalizedId));
      mod.exports = value;
      mod.loaded = true;

      Module._cache[normalizedId] = mod;
    }

    return result;
  },
  // End lifecycle overrides

  // Cache the adapted result in case multiple ES6 modules ask for the same
  // ES5 module, want them to all have === tests if they compare.
  getEs5AdaptedExports: function(normalizedId, depModule) {
    if (hasProp(this.es5AdaptedExports, normalizedId)) {
      return this.es5AdaptedExports[normalizedId];
    } else {
      return (this.es5AdaptedExports[normalizedId] = {
        default: depModule
      });
    }
  }
};


Object.keys(protoMethods).forEach(function(key) {
  lcProto[key] = protoMethods[key];
});


function LoaderLifecyle() {
  Lifecycle.call(this);

  // Tracks if the module was translated from ES module syntax. In those
  // cases the export structure may need to be adjusted.
  this.esType = {};
  this.es5AdaptedExports = {};

  this.translated = {};
}

LoaderLifecyle.prototype = lcProto;

var defaultLoader = new LoaderLifecyle();

// Modify traditional Module require to be aware of ES-ES5 export adaptation,
// later allow for an async require.
var oldRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  var normalizedId = Module._resolveFilename(id, this);
  if (hasProp(defaultLoader.esType, this.id) &&
      !hasProp(defaultLoader.esType, normalizedId)) {
        // es asks for amd: { default: }
        // es asks for es, no conversion
        // amd asks for es, no conversion
        // amd asks for amd, no conversion
    return defaultLoader.getEs5AdaptedExports(normalizedId,
                         defaultLoader.getModule(normalizedId, true));
  }
  return oldRequire.apply(this, arguments);
};

module.exports = function nodeEsAdapt(refId, deps, callback, errback) {
  var p = Promise.all(deps.map(function(dep) {
    return defaultLoader.useUnnormalized(dep, refId);
  }));

  if (callback) {
    p = p.then(function(ary) {
      return callback.apply(undefined, ary);
    }.bind(this));
  }
  if (errback) {
    p = p.catch(errback);
  }
  return p;
};




