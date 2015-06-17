
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

Then in the top level module for the app, format that module as a traditional node module, and require() `node-es-adapt`:

```javascript
var loader = require('node-es-adapt');

// First arg is the module ID of the module using node-es-adapt.
// Second arg is a
loader(module.id, ['./a', 'helper'], function(a, helper) {
  // Use the helper and a modules in here.
});
```

### Command line bootstrap

There is a bin command installed in the package, and can be locally used in a project that has npm installed node-es-adapt locally:

    node_modules/.bin/node-es-adapt main.js

Where main.js can use ES2015 module syntax.

### Constraints

The command line bootstrap is just a small hack to bootstrap the async loader, and it has some constraints:

* require.main is not set correctly. So if main.js in the example above asked for require.main, it would not get the correct value. This should be OK for now, since `require` should not be used inside an ES2015 module, and the ES module system still needs to define a module meta to allow something like require.main to be supported.
* Since the loader is async, tests cannot be written in ES2015 and run via a tool like [mocha](http://mochajs.org/). Tools like mocha support synchronous "compilers" to bootstrap loading, but the goals for this project mean a compehensive solution for those tools is a deeper discussion. It is a solvable issue, but likely will need to wait until a formal ES module loader is specified.

## restrictions

1) In a traditional node module, `require(String)` for es module will fail. This will likely be a restriction in any case for any future ES2015 support due to the async nature ES module loading.

This adapter modifies `require` so that you can do an async require for it, in the same format as an AMD async require.

The async require returns a promise whose resolved value is an array of the dependencies that were requested. However, you can pass a callback function as the second argument to the async require that will receive the dependencies as named arguments.

```javascript
require(['a', 'b'], function(a, b) {
  // a is the module value for 'a'
  // b is the module value for b
}, function(error) {
  // Error handler. As with a normal then promise listener,
  // does not catch errors thrown in the
  // function(a, b){} argument. Use .catch on the returned
  promise to catch those errors.
}).then(function(deps) {
  // deps[0] is the module for 'a'.
  // deps[1] is the module for 'b'.
}).catch(function(error) {
  // Catches any errors from any part of the preceding
  // then chain.
});
```

## Supported

* loader plugins
* level of ES module syntax is from esm-es5, which also depends on esprima.
Either one of those might need updates over time.

## Contrast with amodro-base


## Background




## todo

* allow legacy an async require to use es deps. Requires patch?
* handle main entry point. Requires patch?
* fix require.main for bin usage?
* Explore loader plugins more. A basic test is working, but could use more tests.
