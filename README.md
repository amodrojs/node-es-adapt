## node notes

lifecycle
* normalize uses resolve
* ids can be normalized to file system space
* locate then just uses the ids
* fetch is async

translate
* if translated, then use lifecycle
* if not, use legacy

legacy
* put exports into lifecycle instance, setModule. use lifecycle for export cache.
* allow for require([]) if referencing an es module.

top level load
* parse file, if es, then take the es pathway, and async finish, if possible.

### todo

* handle main entry point. Requires patch?
* allow legacy an async require to use es deps. Requires patch?
* see if loader plugins could work.
* override setModule to reflect export back to traditional require? Don't think it makes sense, but confirm.

### restrictions

* legacy require(String) for es module will fail. Use async require for it.
