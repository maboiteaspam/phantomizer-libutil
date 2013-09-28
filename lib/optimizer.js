
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
            var meta_file =request_path+".meta"+build_profile;

            var options = grunt.file.readJSON(meta_file);

            var tasks_json_file = user_config.meta_dir+request_path+"-"+build_profile+".json";
            var r_tasks_json_file = file_utils.relative_path(tasks_json_file, user_config.wd);
            var tasks = []
            var tasks_options = {}
            for( var i in options.build ){
                for(var task_name in options.build[i] ){
                    var rtask_options = options.build[i][task_name];
                    var task_target = "jit-build"+regen_count;
                    task_name = task_name.split(':')[0];

                    if( ! tasks_options[task_name] )
                        tasks_options[task_name] = {}
                    tasks_options[task_name][task_target] = {options:rtask_options}
                    regen_count++
                    tasks.push("loader_builder:"+r_tasks_json_file+":"+task_name+":"+task_target)
                }
            }

            grunt.file.write( tasks_json_file, JSON.stringify(tasks_options, null, 4) )

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
            options["phantomizer-html-builder"]["options"]["in_requests"] = [request_path];

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


    };
    // Expose the constructor function.
  exports.optimizer = optimizer;
}(typeof exports === 'object' && exports || this));

