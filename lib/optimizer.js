
(function(exports) {

  var fs = require("fs");
  var file_utils = require("./file_utils").file_utils;
  var phantomizer_helper = require("./phantomizer_helper").phantomizer_helper;

  var optimizer = function(meta_manager, user_config,grunt){

    var meta_manager = meta_manager;

    var get_build_url = function(request_path, build_profile){
      return request_path+(build_profile==""?"":"-"+build_profile);
    }

    this.meta_manager = function(meta_manager){
      meta_manager = meta_manager;
    }
    this.user_config = function(user_config){
      user_config = user_config;
    }
    this.is_built = function(build_profile, request_path){
      var retour = false;

      var build_url = get_build_url(request_path, build_profile);

      if( meta_manager.has(build_url) ){
        var fpath = user_config.out_dir+build_url;
        retour = grunt.file.isFile(fpath);
      }
      return retour
    };
    this.is_build_fresh = function(build_profile, request_path){
      var retour = false;

      var build_url = get_build_url(request_path, build_profile);

      var fpath = user_config.out_dir+build_url;

      if( meta_manager.has(build_url) ){
        var entry = meta_manager.load(build_url);

        retour = entry.is_fresh() && fs.existsSync(fpath);
      }
      return retour
    };
    this.read_fresh_build = function(build_profile, request_path, cb){

      var build_url = get_build_url(request_path, build_profile);

      var out_file = user_config.out_dir+build_url;
      if( cb != null ){
        cb(out_file, grunt.file.read(out_file))
      }
    };
    this.regen_build = function(build_profile, request_path, cb){

      var build_url = get_build_url(request_path, build_profile);

      var options = grunt.util._.clone(user_config);

      var out_file = user_config.out_dir+build_url;

      options["phantomizer-html-builder"] = options["phantomizer-html-jitbuild"];
      if( ! options["phantomizer-html-builder"][build_profile] ){
        options["phantomizer-html-builder"][build_profile] = {
          options:{}
        }
      }
      options["phantomizer-html-builder"]["options"]["in_request"] = request_path;

      grunt.config("phantomizer-html-builder",options["phantomizer-html-builder"]);
      grunt.tasks(["phantomizer-html-builder:"+build_profile], options, function(){
        if( cb != null ){
          cb(out_file, grunt.file.read(out_file));
        }
      });
    };
    this.do_build = function(build_profile, request_path, cb){

      var build_url = get_build_url(request_path, build_profile);

      var options = grunt.util._.clone(user_config);

      var out_file = user_config.out_dir+build_url;

      options["phantomizer-html-builder"] = options["phantomizer-html-jitbuild"];
      if( ! options["phantomizer-html-builder"][build_profile] ){
        options["phantomizer-html-builder"][build_profile] = {
          options:{}
        }
      }
      options["phantomizer-html-builder"]["options"]["in_request"] = request_path;

      grunt.config("phantomizer-html-builder",options["phantomizer-html-builder"]);
      grunt.tasks(["phantomizer-html-builder:"+build_profile], options, function(){
        if( cb != null ){
          cb(out_file, grunt.file.read(out_file));
        }
      });
    }


    this.merge_files = function( tgt_file, deps, paths){
      var target_path = user_config.out_dir+tgt_file;
      if(meta_manager.is_fresh(tgt_file) == false || grunt.file.exists(target_path) == false ){
        // materials required to create cache entry
        var entry = meta_manager.create([]);


        if ( grunt.file.exists(process.cwd()+"/Gruntfile.js")) {
          entry.load_dependencies([process.cwd()+"/Gruntfile.js"]);
        }
        if ( grunt.file.exists(user_config.project_dir+"/../config.json")) {
          entry.load_dependencies([user_config.project_dir+"/../config.json"]);
        }
        entry.load_dependencies([target_path]);

        var merge_content = "";
        for( var n in deps ){
          var file_dep = file_utils.find_file(paths, deps[n]);
          if( file_dep ){
            merge_content += grunt.file.read(file_dep);
            entry.load_dependencies([file_dep]);
          }else{
            grunt.log.writeln("Missing dependency to build merged assset")
            grunt.log.writeln("\t"+deps[n])
          }
        }
        grunt.file.write(target_path, merge_content);

        // create a cache entry, so that later we can regen or check freshness
        // entry.require_task(grunt_task, grunt_opt)
        entry.save(tgt_file);
      }
    }





    this.is_combined_asset = function(assets_combination, asset_request_path) {
      if( assets_combination.append ){
        for( var target_merge in assets_combination.append ){
          if( target_merge == asset_request_path ){
            return true;
          }
        }
      }
      if( assets_combination.prepend ){
        for( var target_merge in assets_combination.prepend ){
          if( target_merge == asset_request_path ){
            return true;
          }
        }
      }
      return false;
    }
    this.create_combined_asset = function (assets_combination, source_paths, asset_request_path, cb){
      var task_config = {};
      var tasks = [];

      if( ! task_config["phantomizer-finalizer"] ){
        task_config["phantomizer-finalizer"] = {};
      }

      var add_task = function(target_merge, deps){
        var target_file = user_config.out_dir+"/"+target_merge;
        var entry_path = target_merge+"";

        if( ! meta_manager.is_fresh(entry_path) ){
          var entry = meta_manager.create([]);
          // materials required to create cache entry
          if ( grunt.file.exists(process.cwd()+"/Gruntfile.js")) {
            entry.load_dependencies([process.cwd()+"/Gruntfile.js"]);
          }
          if ( grunt.file.exists(user_config.project_dir+"/../config.json")) {
            entry.load_dependencies([user_config.project_dir+"/../config.json"]);
          }

          for( var n in deps ){
            // file exists as is
            var file_dep = file_utils.find_file(source_paths, deps[n]);
            if( file_dep ){
              deps[n] = file_dep;
              entry.load_dependencies([file_dep]);
            }else{
              if ( fs.existsSync(deps[n]) ){
                if (fs.lstatSync(deps[n]).isDirectory()==false) {
                  deps[n] = deps[n];
                  entry.load_dependencies([deps[n]]);
                }
              }
            }
          }

          target_merge = target_merge.replace(".","_");
          target_merge = target_merge.replace(".","_");
          target_merge = target_merge.replace(".","_");

          if( ! task_config["phantomizer-finalizer"][target_merge] ){
            task_config["phantomizer-finalizer"][target_merge] = {
              options:{
                file_merge:{}
              }
            };
          }
          task_config["phantomizer-finalizer"][target_merge].options.file_merge = {};
          task_config["phantomizer-finalizer"][target_merge].options.file_merge[target_file] = deps;

          tasks.push("phantomizer-finalizer:"+target_merge);
          entry.require_task("phantomizer-finalizer:"+target_merge, task_config);
          entry.save(entry_path);
        }
      }

      if( assets_combination.append ){
        for( var target_merge in assets_combination.append ){
          if( target_merge == asset_request_path ){
            add_task(target_merge, assets_combination.append[target_merge]);
          }
        }
      }
      if( assets_combination.prepend ){
        for( var target_merge in assets_combination.prepend ){
          if( target_merge == asset_request_path ){
            add_task(target_merge, assets_combination.prepend[target_merge]);
          }
        }
      }

      if( tasks.length >0 ){
        grunt.config.init(task_config);
        grunt.tasks(tasks, task_config, function(){
          if( cb != null ){
            cb();
          }
        });
      }else if( cb != null ){
        cb();
      }
    }
    this.create_combined_assets = function(assets_combination, source_paths, cb) {
      var task_config = {};
      var tasks = [];

      if( ! task_config["phantomizer-finalizer"] ){
        task_config["phantomizer-finalizer"] = {};
      }

      var add_task = function(target_merge, deps){
        var target_file = user_config.out_dir+"/"+target_merge;
        var entry_path = target_merge+"";

        // materials required to create cache entry
        if( ! meta_manager.is_fresh(entry_path) ){
          var entry = meta_manager.create([]);
          if ( grunt.file.exists(process.cwd()+"/Gruntfile.js")) {
            entry.load_dependencies([process.cwd()+"/Gruntfile.js"]);
          }
          if ( grunt.file.exists(user_config.project_dir+"/../config.json")) {
            entry.load_dependencies([user_config.project_dir+"/../config.json"]);
          }

          for( var n in deps ){
            var file_dep = file_utils.find_file(source_paths, deps[n]);
            if( file_dep ){
              deps[n] = file_dep
              entry.load_dependencies([file_dep]);
            }
          }

          target_merge = target_merge.replace(".","_");
          target_merge = target_merge.replace(".","_");
          target_merge = target_merge.replace(".","_");

          if( ! task_config["phantomizer-finalizer"][target_merge] ){
            task_config["phantomizer-finalizer"][target_merge] = {
              options:{
                file_merge:{},
                meta_dir:meta_manager.meta_dir
              }
            };
          }
          task_config["phantomizer-finalizer"][target_merge].options.file_merge = {};
          task_config["phantomizer-finalizer"][target_merge].options.file_merge[target_file] = deps;


          tasks.push("phantomizer-finalizer:"+target_merge);
          entry.require_task("phantomizer-finalizer:"+target_merge, task_config);
          entry.save(entry_path);
        }
      }
      if( assets_combination.append ){
        for( var target_merge in assets_combination.append ){
          add_task(target_merge, assets_combination.append[target_merge]);
        }
      }
      if( assets_combination.prepend ){
        for( var target_merge in assets_combination.prepend ){
          add_task(target_merge, assets_combination.prepend[target_merge]);
        }
      }
      if( tasks.length >0 ){
        grunt.config.init(task_config);
        grunt.tasks(tasks, task_config, function(){
          if( cb != null ){
            cb();
          }
        });
      }else if( cb != null ){
        cb();
      }
    }

  };
  // Expose the constructor function.
  exports.optimizer = optimizer;
}(typeof exports === 'object' && exports || this));

