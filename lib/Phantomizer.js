module.exports = exports = function(cwd,grunt) {

  'use strict';

  // initialize some helpers
  var router_factory = require("./router.js").router;
  var optimizer_factory = require("./optimizer.js").optimizer;
  var meta_factory = require("./meta.js").meta;
  var webserver_factory = require("./webserver.js").webserver;

  var that = this;


  var meta_manager = null;
  var optimizer = null;
  var router = null;

  that.get_version = function(){
    var pkg = grunt.file.read(cwd+"/package.json", 'utf-8');
    return JSON.parse(pkg).version;
  };
  that.get_meta_manager = function(){
    if(!meta_manager){
      var config = grunt.config();
      var default_deps = [
        cwd+"/Gruntfile.js",
        config.project_dir+"/config.json"
      ];
      meta_manager = new meta_factory(cwd, config.meta_dir, default_deps);
    }
    return meta_manager;
  };
  that.get_optimizer = function(){
    if(!optimizer){
      var config = grunt.config();
      optimizer = new optimizer_factory(that.get_meta_manager(), config, grunt);
    }
    return optimizer;
  };
  that.get_router = function(){
    if(!router){
      var config = grunt.config();
      router = new router_factory(config.routing);
    }
    return router;
  };
  that.create_webserver = function(web_paths,ready){
    that.get_router().load(function(){
      ready(new webserver_factory(that.get_router(),that.get_optimizer(),that.get_meta_manager(),grunt, web_paths));
    });
  };

};
