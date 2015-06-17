
# node-es-adapt

Uses [amodro-lifecycle](https://github.com/amodrojs/amodro-lifecycle) to allow loading ES2015 modules alongside traditional node modules in node.

The purpose is to test amodro-lifecycle to confirm the lifecycle and its steps are the right sets for the core of a native module loader.

The goal of this project is different than an ES2015 transpiler, like Babel.

The goal is not to convert ES syntax to node ES5 syntax, but to work out the semantics of the loading of ES2015 modules using a loader core that could also work in the browser, and still allow traditional node modules to participate in that system.

## Prerequisites

node v0.12.4 or io.js

## Usage

    npm install node-es-adapt

### Traditional node module bootstrap

In the top level module for the app, format that module as a traditional node module, and `require('node-es-adapt')`:

```javascript
var loader = require('node-es-adapt');

// First arg is the module ID of the module using node-es-adapt.
// Second arg is an array of dependencies you wish to use.
// The loading completes asynchronously.
loader(module.id, ['./a', 'helper'], function(a, helper) {
  // Use the helper and a modules in here.
});
```

### Command line bootstrap

There is a bin command in the package, and can be used in a project that has npm installed node-es-adapt locally like so:

    node_modules/.bin/node-es-adapt main.js

Where main.js be written in ES2015 module syntax.

### Constraints

The command line bootstrap is just a small hack to bootstrap the async loader, and it has some constraints:

* require.main is not set correctly. So if main.js in the example above asked for require.main, it would not get the correct value. This should be OK for now, since `require` should not be used inside an ES2015 formatted module, and the ES module system still needs to define a module meta to allow something like require.main to be supported.
* Since the loader is async, tests cannot be written in ES2015 and run via a tool like [mocha](http://mochajs.org/). Tools like mocha support synchronous "compilers" to bootstrap loading, but the goals for this project mean a compehensive solution for those tools is a deeper discussion. It is a solvable issue, but may need to wait until a formal ES module loader is specified.

## Restrictions

1) In a traditional node module, using `require(String)` go get an ES module will fail. This will likely be a restriction for any future ES2015 solution due to the async nature ES module loading.

This adapter modifies `require` so that the traditional node module can use an async require to get a handle on the ES modue. The async require is similar to the AMD async require.

The async require returns a promise whose resolved value is an array of the dependencies that were requested. However, you can pass a callback function as the second argument to the async require. That callback will receive the dependencies as named arguments.

```javascript
require(['a', 'b'], function(a, b) {
  // a is the module value for 'a'
  // b is the module value for b
}, function(error) {
  // Error handler. As with a normal then promise listener,
  // does not catch errors thrown in the
  // function(a, b){} argument. Use .catch on the returned
  // promise to catch those errors.
}).then(function(deps) {
  // deps[0] is the module for 'a'.
  // deps[1] is the module for 'b'.
}).catch(function(error) {
  // Catches any errors from any part of the preceding
  // then chain.
});
```

## Module features

amodro-lifecycle is used for the loader. index.js overrides some of the lifecycle steps to fit the node environment.

The level of ES module syntax is from [esm-es5](https://github.com/jrburke/esm-es5), which also depends on esprima. Either one of those might need updates if you find a particular ES module syntax does not work. To reiterate, only ES module syntax is converted, this is not a generic "run anything possible in ES2015 in ES5" transpiler.

It uses Node's existing module ID resolution, but provides an extension to support loader plugins, in the style used in AMD: `pluginId!resourceId` where the pluginId can provide an API that matches the lifecycle steps, and the index.js loader will delegate to the plugin for those matching API names.

The plugin support is similar to the one in [amodro-base](https://github.com/amodrojs/amodro-trace), but with some important differences:

* Plugin modules are authored in ES2015 or traditional node syntax, not AMD.
* normalize() uses node normalization rules, which include the nested directory scanning for a matching file.
* Node's existing Module.extensions should continue to work, just implemented in traditional node module syntax.

These differences are important to show the flexibility in amodro-lifecycle to support platform-specific variations while still allowing reuse of module code between for example, the browser and node.

## todo

* handle main entry point maybe via a patch, so that the CLI bin can be skipped?
* fix require.main for bin usage?
* Explore loader plugins more. A basic test is working, but could use more tests.
