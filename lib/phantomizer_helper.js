
(function(exports) {
	var phantomizer_helper = function(){

        var html_utils = require("./html_utils").html_utils;

        this.inject_requirejs = function(rjs_base_url, rjs_url, buf, main_url){
            var ncontent = ""
            ncontent += ""
            if( rjs_url.substring ) rjs_url = [rjs_url]
            for(var n in rjs_url ){
                if( buf.match(rjs_base_url+rjs_url[n]) != null ){
                    if( main_url != null ) ncontent = "<script src='"+main_url+"'></script>"
                    buf = buf.replace("</body>", ncontent+"</body>")
                    return buf;
                }
            }
            if( rjs_url.length > 0 ){
                if( main_url != null ){
                    ncontent = "<script data-main=\""+main_url+"\" src='"+rjs_base_url+rjs_url[0]+"'></script>"
                }else{
                    ncontent = "<script src='"+rjs_base_url+rjs_url[0]+"'></script>"
                    ncontent += "<script>requirejs.config({baseUrl: '"+rjs_base_url+"'});</script>"
                }
                buf = buf.replace("</body>", ncontent+"</body>")
            }
            return buf
        };
        this.inject_after_requirejs = function(rjs_base_url, rjs_url, buf, injected){
            if( rjs_url.substring ) rjs_url = [rjs_url];
            for(var n in rjs_url ){
                if( buf.match(rjs_base_url+rjs_url[n]) != null ){
                    var rjs_node = html_utils.find_rjs_nodes(buf, rjs_url[n], rjs_base_url)[0];
                    var content = "";
                    if( rjs_node.main ){
                        content += "<script src='"+rjs_base_url+rjs_url[n]+"'></script>"
                        content += "<script >"
                        content += "requirejs.config({baseUrl:'"+rjs_base_url+"'});"
                        content += "require(['"+injected+"'], function(){require(['"+rjs_node.main+"']);});"
                        content += "</script>"
                    }else{
                        content = rjs_node.node+"";
                        content += "<script >"
                        content += "requirejs.config({baseUrl:'"+rjs_base_url+"'});"
                        content += "require(['"+injected+"']);"
                        content += "</script>"
                    }
                    buf.replace("<script>requirejs.config({baseUrl: '/js/'});</script>",'');
                    buf = buf.replace(rjs_node.node, content)
                    return buf;
                }
            }
            return buf;
        }
        this.inject_phantom = function(buf){
            var ncontent = ""
            ncontent += "<script >"
            ncontent += "var is_phantom = true;" // to tell the test framework that we run under phantomjs so that is needs to pass information with special methods..
            ncontent += "</script>"
            buf = buf.replace("<head>", "<head>"+ncontent)
            return buf
        };
        this.apply_scripts = function(scripts, base_url, html_content){
            if( scripts.append ){
                for( var target_merge in scripts.append ){
                    var asset_deps = scripts.append[target_merge];
                    html_content = html_utils.strip_scripts(asset_deps, html_content, base_url);
                    html_content = html_utils.append_script(target_merge, html_content );
                }
            }
            if( scripts.prepend ){
                for( var target_merge in scripts.prepend ){
                    var asset_deps = scripts.prepend[target_merge];
                    html_content = html_utils.strip_scripts(asset_deps, html_content, base_url);
                    var anchor = html_utils.script_anchor(html_content, base_url);
                    html_content = html_utils.prepend_script(target_merge, html_content, anchor);
                }
            }
            if( scripts.strip ){
                html_content = html_utils.strip_scripts(scripts.strip, html_content, base_url );
                //grunt.verbose.ok("scripts striped");
            }
            return html_content;
        }
        this.apply_styles = function(styles, base_url, html_content){
            if( styles.append ){
                for( var target_merge in styles.append ){
                    var asset_deps = styles.append[target_merge];
                    html_content = html_utils.strip_css(asset_deps, html_content, base_url);
                    html_content = html_utils.append_css(target_merge, html_content );
                   //grunt.verbose.ok("css injected "+target_merge+", append");
                }
            }
            if( styles.prepend ){
                for( var target_merge in styles.prepend ){
                    var asset_deps = styles.prepend[target_merge];
                    html_content = html_utils.strip_css(asset_deps, html_content, base_url);
                    var anchor = html_utils.css_anchor(html_content, base_url);
                    html_content = html_utils.prepend_css(target_merge, html_content, anchor);
                    //grunt.verbose.ok("css injected "+target_merge+", prepend");
                }
            }
            if( styles.strip ){
                html_content = html_utils.strip_css(styles.strip, html_content, base_url );
                //grunt.verbose.ok("css striped");
            }
            return html_content;
        }
	};
	
	
  // Expose the constructor function.
  exports.phantomizer_helper = new phantomizer_helper();
}(typeof exports === 'object' && exports || this));

