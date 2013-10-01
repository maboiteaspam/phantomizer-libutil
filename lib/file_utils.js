


(function(exports) {

    var path = require('path');
    var os = require('os')
    var fs = require('fs');


    var file_utils = function(){
        var that = this;
        this.make_absolute_path = function(base_dir, file){
            file = this.norm_path( file )

            if( os.type() == "Linux" && file.substring(0,1) != "/" ){
                file = base_dir+"/"+file
            }else if( os.type() == "Windows_NT" && file.match("^[a-zA-Z]:","ig") == null ){
                file = base_dir+"/"+file
            }

            return this.norm_path( file )
        }
        this.norm_path = function( f_path ){
            if( os.type() == "Windows_NT"){
                f_path = f_path.replace("/","\\")
                f_path = f_path.replace("/","\\")
            }else{
                f_path = f_path.replace("\\","/")
                f_path = f_path.replace("\\","/")
            }
            f_path = f_path.replace("\\\\","\\")
            f_path = f_path.replace("\\\\","\\")
            f_path = f_path.replace("//","/")
            f_path = f_path.replace("//","/")
            return f_path
        }
        this.relative_path = function( fpath, wd ){
            fpath = this.make_absolute_path(wd, fpath)
            wd = this.make_absolute_path(wd, "")

            return fpath.substr(wd.length)
        }
        this.find_file = function(paths, request){
            for( var n in paths ){
                var root_path = this.norm_path(paths[n])
                var r_name = this.norm_path("/"+(path.basename(root_path)))
                request = this.norm_path("/"+request)
                if( r_name == request.substring(0,r_name.length) ){
                    request = request.substring(r_name.length)
                }
                var fpath = this.norm_path(root_path+"/"+request);

                if ( fs.existsSync(fpath) ){
                    if (fs.lstatSync(fpath).isDirectory()==false) {
                        return fpath;
                    }
                }
            }
        }
        this.find_dir = function(paths, request){
            for( var n in paths ){
                var root_path = this.norm_path(paths[n])
                var r_name = this.norm_path("/"+(path.basename(root_path))+"/")
                request = this.norm_path("/"+request+"/")
                if( r_name == request.substring(0,r_name.length) ){
                    request = request.substring(r_name.length)
                }
                var fpath = this.norm_path(root_path+"/"+request)
                if ( fs.existsSync(fpath) ){
                    if (fs.lstatSync(fpath).isDirectory()) {
                        return fpath;
                    }
                }
            }
        }
        this.deleteFolderRecursive = function(fpath){
            if( fs.existsSync(fpath) ) {
                fs.readdirSync(fpath).forEach(function(file,index){
                    var curPath = fpath + "/" + file;
                    if(fs.statSync(curPath).isDirectory()) { // recurse
                        that.deleteFolderRecursive(curPath);
                    } else { // delete file
                        fs.unlinkSync(curPath);
                    }
                });
                fs.rmdirSync(fpath);
            }
        };
        this.copyFile = function(from, to, overwrite){
            if( fs.existsSync(to) == false && !overwrite ){
                fs.writeFileSync(to, fs.readFileSync(from) )
            }
        };
        this.readJSON = function(file, charset){
            return JSON.parse(fs.readFileSync(file, charset || 'utf8'));
        };
        this.writeJSON = function(file,data,pretty){
            return fs.writeFileSync(file, JSON.stringify(data, null, pretty?4:0))
        };
    };


    // Expose the constructor function.
    exports.file_utils = new file_utils();
}(typeof exports === 'object' && exports || this));
