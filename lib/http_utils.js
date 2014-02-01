
var http_utils = function(){
    var path = require("path");
    var fs = require("fs");

    this.output = "";
    this.logger = {
        "append":function(msg){
            this.output+=msg
        },
        "lines":function(){
            return this.output.split("\n")
        },
        "reset":function(){
            this.output = "";
        }
    };
    this.get_param = function(url, param_name) {
        var pattern = ".*[&?]"+param_name+"=([^&]*)"
        pattern = new RegExp(pattern,"i");
        var matches = url.match(pattern)
        var param = "";
        if ( matches ) {
            param = matches[1];
        }
        return param
    };
    this.header_content_type = function(fpath){
        var retour = 'text/plain';
        var types = {
            ".css":"text/css"
            ,".html":"text/html"
            ,".htm":"text/html"
            ,".png":"image/gif"
            ,".jpeg":"image/jpeg"
            ,".jpg":"image/jpeg"
            ,".png":"image/png"
            ,".js":"text/javascript"
            ,".json":"application/json"
            ,".appcache":"text/cache-manifest"
        };
        for( var ext in types ){
            if( fpath.substring(fpath.length-ext.length,fpath.length).toLowerCase() == ext ){
                retour = types[ext]
                break;
            }
        }
        return retour
    };
    this.merged_dirs = function(paths, request){
        var f_list = [];
        var known = [];

        request = path.normalize(request).replace("\\","/");
        request = request.substring(request.length-1)=="/"?request.substring(0,request.length-1):request;

        for( var n in paths ){
            if( fs.existsSync(paths[n]+request) ){
                var files = fs.readdirSync( paths[n]+request );
                for( var n in files ){
                    var r_ = request+"/"+files[n];
                    if( known.indexOf(r_) == -1 ){
                        f_list.push({
                            "name":files[n],
                            "path":r_
                        });
                        known.push(r_);
                    }
                }
            }
        }

        return f_list
    };
};

	
exports.http_utils = new http_utils();
