
# node-es-adapt

Uses [amodro-lifecycle](https://github.com/amodrojs/amodro-lifecycle) to allow loading ES2015 modules alongside traditional node modules in node.

The purpose is to test amodro-lifecycle to confirm the lifecycle and its steps are the right sets for the core of a native module loader.

## Prerequisites

node v0.12.4 or io.js

## Usage

    npm install node-es-adapt

Then in the top level module for the app, format that module as a traditional node module, and require() `node-es-adapt`:

```javascript
var loader = require('node-es-adapt');

// First arg is the module ID of the module using node-es-adapt.
// Second arg is a
loader(module.id, ['.a', 'helper'], function(a, helper) {
  // Use the helper and a modules in here.
});
```

The next step is to allow the top level module be an ES2015 module and to hook in node-es-adapt to loading the top level module. This might require applying a patch to node and building node to try that part.

## restrictions

1) In a traditional node module, `require(String)` for es module will fail. This will likely be a restriction in any case for any future ES2015 support due to the async nature ES module loading.

This adapter modifies `require` so that you can do an async require for it, in the same format as an AMD async require.

The async require returns a promise whose resolved value is an array of the dependencies that were requested. However, you can pass a callback function as the second argument to the async require that will receive the dependencies as named arguments.

```javascript


require(['a', 'b'], function(a, b) {

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

* dual test

## Supported

* loader plugins

## Contrast with amodro-base


## Background




## todo

* allow legacy an async require to use es deps. Requires patch?
* handle main entry point. Requires patch?
* Explore loader plugins more. A basic test is working, but could use more tests.
