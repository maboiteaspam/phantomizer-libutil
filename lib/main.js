
exports.html_utils = require('./html_utils.js').html_utils;
exports.http_utils = require('./http_utils.js').http_utils;
exports.phantomizer_helper = require('./phantomizer_helper.js').phantomizer_helper;
exports.file_utils = require('./file_utils.js').file_utils;
exports.webserver = require('./webserver.js').webserver;

// exported function
// ------------
var Phantomizer = require(__dirname+"/Phantomizer.js")
var instances = {};

/**
 *
 * @returns Phantomizer
 */
exports.main = function(){
  return instances["main"];
};
exports.get = function(name){
  return instances[name];
};
exports.register = function(name,cwd,grunt){
  instances[name] = new Phantomizer(cwd,grunt);
  return instances[name];
};


