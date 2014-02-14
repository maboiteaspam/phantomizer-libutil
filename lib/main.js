
(function(){
// The module to be exported.
  var libutil = {
    'meta':null,
    'html_utils':null,
    'http_utils':null,
    'optimizer':null,
    'phantomizer_helper':null,
    'router':null,
    'file_utils':null,
    'delivery_queue':null,
    'webserver':null
  };

  for( var name in libutil ){
    var t = require('./' + name + '.js');
    libutil[name] = t[name]?t[name]:t
  }
  module.exports = libutil;

  // exported function
  // ------------
  var Phantomizer = require(__dirname+"/Phantomizer.js")
  var instances = {};

  /**
   *
   * @returns Phantomizer
   */
  module.exports.main = function(){
    return instances["main"];
  };
  module.exports.get = function(name){
    return instances[name];
  };
  module.exports.register = function(name,cwd,grunt){
    instances[name] = new Phantomizer(cwd,grunt);
    return instances[name];
  };
})()
