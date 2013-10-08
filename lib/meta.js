/*


 */


(function(exports) {

    var path = require('path');
    var _ = require('underscore');
    var fs = require('fs');


    var meta_entry = (function(){
        return function(){
            this._base_dir = '';
            this._meta_dir = '';
            this.reference_time = '';
            this.build = [];
            this.tasks_opts = {};
            this.dependences = [];
            this.extras = {};

            var that = this;
            this.save = function(out_path, cb){
                out_path = that._meta_dir+out_path;
                that.update_dependences_addressing();
                that.dedup_dependencies();
                that.update_reference_time();
                var o = {}
                _.extend(o, that)
                delete o._base_dir;
                delete o._meta_dir;
                var contents = JSON.stringify(o, null, 4);
                var dirpath = path.dirname(out_path);

                var pathSeparatorRe = /[\/\\]/g;
                var mode = parseInt('0777', 8) & (~process.umask());
                dirpath.split(pathSeparatorRe).reduce(function(parts, part) {
                    parts += part + '/';
                    var subpath = path.resolve(parts);
                    if (!fs.existsSync(subpath)) {
                        try {
                            fs.mkdirSync(subpath, mode);
                        } catch(e) {
                            throw ('Unable to create directory "' + subpath + '" (Error code: ' + e.code + ').', e);
                        }
                    }
                    return parts;
                }, '');
                fs.writeFileSync(out_path, contents);


                if( cb ) cb(null);
            }
            this.require_task = function(build_cmd, options){
                that.build.push(build_cmd);
                that.tasks_opts[build_cmd] = options;
                return that;
            }
            this.has_task = function(build_cmd){
                return that.build.indexOf(build_cmd)>-1;
            }
            this.is_fresh = function(){
                var time = that.reference_time;
                var is_fresh = true;
                for( var n in that.dependences ){
                    var filename = that.dependences[n];
                    if ( fs.existsSync(filename) ){
                        var ft = fs.statSync(filename);
                        is_fresh = is_fresh && ft.mtime <= time;
                    }else{
                        is_fresh = false;
                    }
                }
                return is_fresh
            }
            this.update_reference_time = function(){
                var time = 0
                for( var n in that.dependences ){
                    var filename = that.dependences[n];
                    var ft = fs.statSync(filename);
                    time = ft.mtime > time ? ft.mtime : time
                }
                that.reference_time = time
                return time
            }
            this.update_dependences_addressing = function(){
                for( var n in that.dependences ){
                    that.dependences[n] = this.update_dependence_addressing(that.dependences[n]);
                }
            }
            this.update_dependence_addressing = function(filename){
                var base_dir = that._base_dir;

                filename.replace("\\\\","\\").replace("//","/");
                filename = path.resolve(filename);

                if( filename.substring(0,base_dir.length) == base_dir ){
                    filename = filename.substring(base_dir.length);
                }else{
                    filename = path.resolve(filename);
                }
                return filename

            }
            this.dedup_dependencies = function(){
                var deps = this.dependences;
                this.dependences = [];
                this.load_dependencies(deps);
            }
            this.load_dependencies = function(dependencies){
                for( var n in dependencies ){
                    var k = this.update_dependence_addressing(dependencies[n]);
                    if( this.dependences.indexOf(k) == -1 ){
                        this.dependences.push(k);
                    }
                }
            }
        }
    })();


    var meta_manager = function(base_dir, meta_dir){
        this.base_dir = path.resolve(base_dir)+"/";
        this.meta_dir = path.resolve(meta_dir)+"/";
        var that = this
        this.create = function(deps){
            var entry = new meta_entry()
            entry._base_dir = that.base_dir;
            entry._meta_dir = that.meta_dir;
            entry.load_dependencies(deps)
            return entry
        }
        this.load = function(meta_path){
            var entry = new meta_entry();
            entry._base_dir = that.base_dir;
            entry._meta_dir = that.meta_dir;
            var m = meta_dir+meta_path;
            if( fs.existsSync(m) ){
                var object =  JSON.parse( fs.readFileSync(m, 'utf8') )
                entry.reference_time = new Date(object.reference_time)
                entry.build = object.build;
                entry.tasks_opts = object.tasks_opts;
                entry.dependences = object.dependences;
                entry.extras = object.extras;
            }
            return entry
        }
        this.has = function(meta_path){
            return fs.existsSync(meta_dir+meta_path)
        }
        this.is_fresh = function( meta_file, required_task ){
            var is_fresh = this.has(meta_file);
            if( is_fresh ){
                var entry = this.load(meta_file)
                is_fresh = entry.is_fresh();
                if( required_task ){
                    is_fresh = is_fresh && entry.has_task(required_task);
                }
            }
            return is_fresh
        }
    };


    // Expose the constructor function.
    exports.meta = meta_manager;
}(typeof exports === 'object' && exports || this));
