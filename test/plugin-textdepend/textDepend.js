import text from '../lib/text!./test.txt';

export default {
  fetch: function (loader, resourceId, refId, location) {
    loader.setModule(module.id + '!' + resourceId, text);
  }
};
