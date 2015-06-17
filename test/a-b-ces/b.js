module.exports = {
  name: 'b',
  runC: function() {
    return require(['./sub/c']);
  }
};

