
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
		this.http_from_fs = function(base_paths, relative_path, found){
			for( var t in base_paths ){
				try {
					var fpath = base_paths[t]+relative_path
					
					stats = fs.lstatSync(fpath)
					if( stats.isDirectory() ){
						var files = fs.readdirSync(fpath);
						var content = ""
						for(var i in files) {
							var y = relative_path+"/"+files[i]
							y = y.replace("//","/")
							content += "<a href='"+y+"'>"+y+"</a><br/>"
						}
						found("directory", fpath, content)
					} else{
						fs.readFile(fpath, function(err, buf){
							found("file", fpath, buf)
						});
					}
					return true;
				}
				catch (e) {
				}
			}
			return false;
		};
        this.merged_dirs = function(paths, request){
            var f_list = []

            request = path.normalize(request).replace("\\","/");
            request = request.substring(request.length-1)=="/"?request.substring(0,request.length-1):request;

            for( var n in paths ){
                if( fs.existsSync(paths[n]+request) ){
                    var files = fs.readdirSync( paths[n]+request );
                    for( var n in files ){
                        f_list.push({
                            "name":files[n],
                            "path":request+"/"+files[n]
                        })
                    }
                }
            }

            return f_list
        };
        this.read_dir = function(base_path, request){
            var f_list = []

            request = path.normalize(request).replace("\\","/");
            request = request.substring(request.length-1)=="/"?request.substring(0,request.length-1):request;

            if( fs.existsSync(base_path+request) ){
                var files = fs.readdirSync( base_path+request );
                for( var n in files ){
                    f_list.push({
                        "name":files[n],
                        "path":request+"/"+files[n]
                    })
                }
            }

            return f_list
        }
	};
	
	
exports.http_utils = new http_utils();
