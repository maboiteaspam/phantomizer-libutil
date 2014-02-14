
var singleton = function singleton(){

  var instances = {};

  var Phantomizer = require(__dirname+"/Phantomizer.js");

  this.main = function(userId, socket){
    return instances["main"];
  };

  this.get = function(name){
    return instances[name];
  };

  this.register = function(name,cwd,grunt){
    instances[name] = new Phantomizer(cwd,grunt);
    return instances[name];
  };

  if(singleton.caller != singleton.getInstance){
    throw new Error("This object cannot be instanciated");
  }
}

/* ************************************************************************
 SINGLETON CLASS DEFINITION
 ************************************************************************ */
singleton.instance = null;

/**
 * Singleton getInstance definition
 * @return singleton class
 */
singleton.getInstance = function(){
  if(this.instance === null){
    this.instance = new singleton();
  }
  return this.instance;
}

module.exports = singleton.getInstance();

module.exports.html_utils = require('./html_utils.js').html_utils;
module.exports.http_utils = require('./http_utils.js').http_utils;
module.exports.phantomizer_helper = require('./phantomizer_helper.js').phantomizer_helper;
module.exports.file_utils = require('./file_utils.js').file_utils;
module.exports.webserver = require('./webserver.js').webserver;


