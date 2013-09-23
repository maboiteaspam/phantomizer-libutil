


(function(exports) {

    var path = require('path');
    var _ = require('underscore');
    var fs = require('fs');

    function is_in_array(arr,search){
        for( var n in arr ){
            if( arr[n] == search ) return true;
        }
        return false;
    }

    var meta_entry = (function(){
        return function(){
            this._base_dir = '';
            this._meta_dir = '';
            this.reference_time = '';
            this.build = [];
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
                var b = {};
                b[build_cmd] = options;
                that.build.push(b);
                return that;
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

                if( filename.substring(0,base_dir.length-1) == base_dir ){
                    filename = filename.substring(base_dir.length+1);
                }else{
                    filename = path.resolve(base_dir+filename).substring(base_dir.length-1);
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
                    if( is_in_array(this.dependences,  dependencies[n]) == false ){
                        this.dependences.push( this.update_dependence_addressing(dependencies[n]) );
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
            d = fs.readFileSync(meta_dir+meta_path, 'utf8')
            var entry = new meta_entry()
            var object =  JSON.parse(d)
            entry.reference_time = new Date(object.reference_time)
            entry.build = object.build;
            entry.dependences = object.dependences;
            entry._base_dir = object.base_dir;
            entry._meta_dir = object.meta_dir;
            entry.extras = object.extras;
            return entry
        }
        this.has = function(meta_path){
            return fs.existsSync(meta_dir+meta_path)
        }
        this.is_fresh = function( meta_file ){
            var is_fresh = this.has(meta_file);
            if( is_fresh ){
                var entry = this.load(meta_file)
                is_fresh = entry.is_fresh();
            }
            return is_fresh
        }
    };


    // Expose the constructor function.
    exports.meta = meta_manager;
}(typeof exports === 'object' && exports || this));
