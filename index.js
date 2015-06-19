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

function setTranslated(loader, normalizedId, esmResult) {
  loader.translated[normalizedId] = esmResult;
  loader.esType[normalizedId] = true;
  loader.addToRegistry(normalizedId,
                 loader.translated[normalizedId].depIds);
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

    var normalizedId;
    try {
      normalizedId = Module._resolveFilename(id, parent);
    } catch(e) {
      if (hasProp(this.pluginNormalized, id)) {
//todo: what is id is './a'? should there be a bare minimum of dot resolution
//here?
        return id;
      } else {
        throw e;
      }
    }

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

    if (hasProp(this.pluginFetched, location)) {
      delete this.pluginFetched[location];
      return fs.readFileSync(location, 'utf8');
    } else if (!value) {
      var source = stripBOM(fs.readFileSync(location, 'utf8'));
      var esmResult;
      try {
        esmResult = esmEs5(source);
      } catch(e) {
        throw new Error('esmEs5 error for ' + normalizedId + ': ' + e);
      }
      if (!esmResult.translated) {
        // Traditional load.
        var refModule = new Module(refId);
        refModule.filename = refId;
        refModule.paths = Module._nodeModulePaths(path.dirname(refId));
        value = Module._load(normalizedId, refId ? refModule : null);
      } else {
        setTranslated(this, normalizedId, esmResult);
      }
    }

    // Update module cache for this loader, to skip this work next time.
    if (value) {
      this.setModule(normalizedId, value);
    }
  },

  translate: function(normalizedId, location, source) {
    // Expected that this should only be called in loader plugin cases.
    var esmResult = esmEs5(source);
    if (esmResult.translated) {
      setTranslated(this, normalizedId, esmResult);
      // Since it has been translated and have something in the registry,
      // and relying on the Module._compile to do the actual execution in
      // instantiate, return empty source here.
      return '';
    }

    return source;
  },

  depend: function(normalizedId, deps) {
    // No plugin support yet, so just return deps.
    return deps;
  },

  parse: function(normalizedId, location, source) {
    // The result of this should be something in the registry.
  },

  instantiate: function(normalizedId, normalizedDeps, factory) {
    var esmResult = this.translated[normalizedId];
    delete this.translated[normalizedId];

    // This could be a fancier, native ES loader assisted process, but since
    // the source has already been transformed to es5 syntax, then leverage
    // traditional system to do the load, allows for debug breakpoints then
    // too. This is also why the work is done here instead of parse.
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
  this.pluginFetched = {};
  this.pluginNormalized = {};
}

LoaderLifecyle.prototype = lcProto;

var defaultLoader = new LoaderLifecyle();

function asyncRequire(refId, deps, callback, errback) {
  var p = Promise.resolve()
  .then(function() {
    return Promise.all(deps.map(function(dep) {
      return defaultLoader.useUnnormalized(dep, refId);
    }));
  });

  if (callback) {
    p = p.then(function(ary) {
      return callback.apply(undefined, ary);
    });
  }
  if (errback) {
    p = p.catch(errback);
  }
  return p;
}

// Modify traditional Module require to be aware of ES-ES5 export adaptation,
// later allow for an async require.
var oldRequire = Module.prototype.require;
Module.prototype.require = function(id, callback, errback) {
  var normalizedId;

  if (Array.isArray(id)) {
    return asyncRequire(this.id, id, callback, errback);
  }

  if (id.indexOf('!') !== -1) {
    normalizedId = defaultLoader.normalize(id, this.id);
    return defaultLoader.getModule(normalizedId, true);
  }

  normalizedId = Module._resolveFilename(id, this);
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

// Temporarily inline the loader plugin support, just to prove out the flow,
// but long term pull this in as as a separate file.

// Optional parts that can further modify the lifecycle prototypes.
var protoModifiers = [];

// START plugins.js
// MODIFIED to remove legacy plugin support, bundles config, isScriptLocation
protoModifiers.push(function (proto) {
  var slice = Array.prototype.slice,
      oldMethods = {},
      methods = ['normalize', 'locate', 'fetch', 'translate',
                 'depend', 'instantiate'],
      customOverrides = {
        normalize: true,
        locate: true,
        fetch: true,
        depend: true,
        //NOTE different from amodro-base
        translate: true
      };

  function interceptMethod(methodName) {
    return function(normalizedId) {
      var args = slice.call(arguments);
      var pluginDesc = this.getPluginDesc(normalizedId);
      if (pluginDesc) {
        var plugin = pluginDesc.plugin;
        if (plugin && plugin[methodName]) {
          args[0] = pluginDesc.resourceId;
          args.unshift(this.getPluginProxy());
          return plugin[methodName].apply(this, args);
        }
      }

      return oldMethods[methodName].apply(this, args);
    };
  }

  methods.forEach(function(methodName) {
    oldMethods[methodName] = proto[methodName];
    if (!customOverrides[methodName]) {
      proto[methodName] = interceptMethod(methodName);
    }
  });

  proto.normalize = function(id, refId) {
    var index = id.indexOf('!');

    // If a '!something' ID, then just remove the ! and continue on.
    if (index === 0) {
       id = id.substring(1);
    }

    if (index > 0) {
      var pluginId = this.normalize(id.substring(0, index), refId),
          plugin = this.getModule(pluginId),
          resourceId = id.substring(index + 1);

      if (plugin && plugin.normalize) {
        // Shiny new API.
        return pluginId + '!' +
               plugin.normalize(this.getPluginProxy(), resourceId, refId);
      } else {
        this.pluginNormalized[resourceId] = true;
        var result = pluginId + '!' +
                     oldMethods.normalize.call(this, resourceId, refId);
        delete this.pluginNormalized[resourceId];
        return result;
      }
    } else {
      return oldMethods.normalize.call(this, id, refId);
    }
  };

  proto.depend = function(normalizedId, deps) {
    var plugins = [],
        definedPlugins = {};

    deps.forEach(function(id) {
      var index = id.indexOf('!');
      if (index !== -1) {
        var normalizedDep = this
                            .normalize(id.substring(0, index), normalizedId);

        if (!normalizedDep) {
          return;
        }

        // Do not do extra work if the plugin has already been loaded.
        if (!hasProp(definedPlugins, normalizedId)) {
          definedPlugins[normalizedDep] = !!this.getModule(normalizedDep) &&
                                          !this.getWaiting(normalizedDep);
        }

        if (!definedPlugins[normalizedDep] &&
            plugins.indexOf(normalizedDep) === -1) {
          plugins.push(normalizedDep);
        }
      }
    }.bind(this));

    if (plugins.length) {
      return Promise.all(plugins.map(function(pluginId) {
        return this.use(pluginId, normalizedId);
      }.bind(this))).then(function() {
        return oldMethods.depend.call(this, normalizedId, deps);
      }.bind(this));
    } else {
      return oldMethods.depend.call(this, normalizedId, deps);
    }
  };

  proto.locate = function(normalizedId, suggestedExtension) {
    var location,
        ignoreJsForScript = false,
        pluginDesc = this.getPluginDesc(normalizedId);

    if (pluginDesc) {
      if (!pluginDesc.id) {
        // The badly formed '!something' case.
        normalizedId = pluginDesc.resourceId;
      } else {
        var plugin = pluginDesc.plugin,
            resourceId = pluginDesc.resourceId;
        if (plugin) {
          if (plugin.locate) {
            location = plugin.locate(this.getPluginProxy(),
                                    normalizedId, suggestedExtension);
          } else if (hasProp(plugin, 'locateExtension')) {
            suggestedExtension = plugin.locateExtension;
            location = oldMethods.locate.call(this,
                                              resourceId,
                                              suggestedExtension);
          } else if (plugin.locateDetectExtension) {
            ignoreJsForScript = true;
            var index = resourceId.lastIndexOf('.');
            if (index !== -1) {
              //NOTE: different from amodro-base: since normalize already
              //identifiese the path just return that value.
              return resourceId;
            }
          }
        }
      }
    }

    if (!location) {
      location = oldMethods.locate.call(this, normalizedId, suggestedExtension);
    }

    return location;
  };

  proto.fetch = function(normalizedId, refId, location) {
    var pluginDesc = this.getPluginDesc(normalizedId);
    if (pluginDesc) {
      if (!pluginDesc.id) {
        // The badly formed '!something' case.
        normalizedId = pluginDesc.resourceId;
      } else {
        var plugin = pluginDesc.plugin,
            resourceId = pluginDesc.resourceId;

        if (plugin) {
          if (plugin.fetch) {
            return plugin.fetch(this.getPluginProxy(),
                                resourceId, refId, location);
          } else {
            //NOTE: this is different than browser loader.
            this.pluginFetched[location] = true;
            return oldMethods.fetch.call(this, resourceId, refId, location);
          }
        } else {
          // Plugin not loaded yet. This could happen in the alias config case,
          // where the 'a' is mapped to 'plugin!resource'. Unfortunately in that
          // case cannot resolve a cycle if it exists between original module
          // with dependency on 'a' but has a cycle with 'plugin!resource'.
          return this.use(pluginDesc.id).then(function() {
            return this.fetch(normalizedId, refId, location);
          }.bind(this));
        }
      }
    }

    return oldMethods.fetch.call(this, normalizedId, refId, location);
  };

  proto.translate = function(normalizedId, location, source) {
    var args = slice.call(arguments);
    var pluginDesc = this.getPluginDesc(normalizedId);
    if (pluginDesc) {
      var plugin = pluginDesc.plugin;
      if (plugin && plugin.translate) {
        args[0] = pluginDesc.resourceId;
        args.unshift(this.getPluginProxy());

        // NOTE different from amodro-base, ask for default translate to
        // do work, since the idea is that plugins here generate ES module
        // syntax.
        source = plugin.translate.apply(this, args);
        return oldMethods.translate.call(this, normalizedId, location, source);
      }
    }

    return oldMethods.translate.apply(this, args);
  };

  function makeProxyMethod(proxy, methodName, instance) {
    proxy[methodName] = function() {
      var args = slice.call(arguments);
      return instance[methodName].apply(instance, args);
    };
  }

  function makeProxy(instance) {
    var proxy = {};
    methods.forEach(function(methodName) {
      makeProxyMethod(proxy, methodName, instance);
    });

    // Add some proxied methods for some loader pieces
    makeProxyMethod(proxy, 'useUnnormalized', instance);
    makeProxyMethod(proxy, 'use', instance);
    makeProxyMethod(proxy, 'setModule', instance);
    makeProxyMethod(proxy, 'parse', instance);
    makeProxyMethod(proxy, 'getData', instance);

    return proxy;
  }

  var protoMethods = {
    getPluginDesc: function(normalizedId) {
      var index = normalizedId.indexOf('!');
      if (index > -1) {
        var plugId = normalizedId.substring(0, index);
        return {
          id: plugId,
          resourceId: normalizedId.substring(index + 1),
          plugin: this.getModule(plugId)
        };
      }
    },

    getPluginProxy: function() {
      return this.pluginProxy || (this.pluginProxy = makeProxy(this));
    }
  };

  Object.keys(protoMethods).forEach(function(key) {
    proto[key] = protoMethods[key];
  });
});
// END plugins.js

protoModifiers.forEach(function(modify) {
  modify(lcProto);
});

