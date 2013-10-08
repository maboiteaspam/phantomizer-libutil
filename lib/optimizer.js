
(function(exports) {

    var fs = require("fs");
    var grunt = require("grunt");
    var file_utils = require("./file_utils").file_utils;
    var phantomizer_helper = require("./phantomizer_helper").phantomizer_helper;

    var regen_count  = 0;
    var optimizer = function(meta_manager, user_config){
        var meta_manager = meta_manager;


        this.meta_manager = function(meta_manager){
            meta_manager = meta_manager;
        }
        this.user_config = function(user_config){
            user_config = user_config;
        }
        this.is_built = function(build_profile, request_path){
            var retour = false;

            var meta_request_path = request_path+".meta"+build_profile;

            var fpath = user_config.out_dir+request_path+build_profile;
            if( meta_manager.has(meta_request_path) ){
                retour = grunt.file.isFile(fpath);
            }
            return retour
        }
        this.is_build_fresh = function(build_profile, request_path){
            var retour = false;

            var meta_request_path = request_path+".meta"+build_profile;
            var fpath = user_config.out_dir+request_path+build_profile;

            if( meta_manager.has(meta_request_path) ){
                var entry = meta_manager.load(meta_request_path);

                retour = entry.is_fresh() && fs.existsSync(fpath);
            }
            return retour
        }
        this.regen_build = function(build_profile, request_path, cb){

            var out_file = user_config.out_dir+request_path+build_profile;
            var meta_file =user_config.meta_dir+request_path+".meta"+build_profile;

            var options = grunt.file.readJSON(meta_file);

            build_profile = build_profile==""?"":"-"+build_profile;

            var tasks_json_file = user_config.meta_dir+request_path+build_profile+".json";
            var r_tasks_json_file = file_utils.relative_path(tasks_json_file, user_config.wd);
            var tasks = []
            var tasks_options = {};

            for( var i in options.build ){
                var task_name = options.build[i];
                var rtask_options = options.tasks_opts[task_name];
                var task_target = task_name.split(":")[1];
                task_target = task_target+regen_count;
                task_name = task_name.split(":")[0];

                var o_options = grunt.config.get(task_name);
                o_options[task_target] = {
                    options:rtask_options
                };

                grunt.config.set(task_name,o_options);
                tasks.push(task_name+":"+task_target);
            }

            grunt.tasks(tasks, {}, function(){
                if( cb != null ){
                    cb(out_file, grunt.file.read(out_file))
                }
            });
        }
        this.do_build = function(build_profile, request_path, cb){
            var str_build_profile=build_profile==""?"":"-"+build_profile;

            var options = grunt.util._.clone(user_config);

            var out_file = user_config.out_dir+request_path+str_build_profile;
            var meta_file = request_path+str_build_profile;

            options["phantomizer-html-builder"] = options["phantomizer-html-jitbuild"];
            if( ! options["phantomizer-html-builder"][build_profile] ){
                options["phantomizer-html-builder"][build_profile] = {
                    options:{}
                }
            }
            options["phantomizer-html-builder"]["options"]["in_request"] = request_path;

            var json_file = user_config.meta_dir+request_path+str_build_profile+".json";
            grunt.file.write( json_file, JSON.stringify(options, null, 4) );
            json_file = file_utils.relative_path(json_file, user_config.wd);

            grunt.tasks(["loader_builder:"+json_file+":phantomizer-html-builder:"+build_profile+":"+request_path], options, function(){
                if( cb != null ){
                    cb(out_file, grunt.file.read(out_file));
                }
            });
        }


        this.merge_files = function( tgt_file, deps, paths){
            var entry_path = tgt_file+".meta";
            var target_path = user_config.out_dir+tgt_file+"";
            if(meta_manager.is_fresh(entry_path) == false ){
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
                    if( file_dep != false ){
                        merge_content += grunt.file.read(file_dep);
                        entry.load_dependencies([file_dep]);
                    }
                }
                grunt.file.write(target_path, merge_content);

                // create a cache entry, so that later we can regen or check freshness
                // entry.require_task(grunt_task, grunt_opt)
                entry.save(entry_path);
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
                var entry_path = target_merge+".meta";

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
                var entry_path = target_merge+".meta";

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

