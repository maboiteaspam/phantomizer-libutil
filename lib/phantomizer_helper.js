
(function(exports) {
	var phantomizer_helper = function(){

        var html_utils = require("./html_utils").html_utils;

        this.inject_requirejs = function(base_url, script_name, buf, main){
            var ncontent = ""
            ncontent += ""
            if( script_name.substring ) script_name = [script_name]
            for(var n in script_name ){
                if( buf.match(base_url+script_name[n]) != null ){
                    if( main != null ) ncontent = "<script src='"+main+"'></script>"
                    buf = buf.replace("</body>", ncontent+"</body>")
                    return buf;
                }
            }
            if( script_name.length > 0 ){
                if( main != null ){
                    ncontent = "<script data-main=\""+main+"\" src='"+base_url+script_name[0]+"'></script>"
                }else{
                    ncontent = "<script src='"+base_url+script_name[0]+"'></script>"
                    ncontent += "<script>requirejs.config({baseUrl: '"+base_url+"'});</script>"
                }
                buf = buf.replace("</body>", ncontent+"</body>")
            }
            return buf
        };
        this.inject_phantom = function(buf){
            var ncontent = ""
            ncontent += "<script >"
            ncontent += "var is_phantom = true;" // to tell the test framework that we run under phantomjs so that is needs to pass information with special methods..
            ncontent += "</script>"
            buf = buf.replace("<head>", ncontent+"<head>")
            return buf
        };
        this.inject_qunit = function(base_url, script_name, buf){
            var ncontent = ""
            ncontent += "<link rel=\"stylesheet\" href=\"/js/vendors/go-qunit/qunit-1.11.0.css\">"
            buf = buf.replace("<head>", "<head>"+ncontent)

            ncontent = ""
            buf = this.inject_requirejs(base_url,script_name, buf)
            ncontent += "<script >"
            ncontent += "require(['vendors/go-qunit']);"
            ncontent += "</script>"
            buf = buf.replace("</body>", ncontent+"</body>")
            return buf
        };
        this.inject_device_preview = function(base_url, script_name, buf, device, device_mode){
            var ncontent = ""
            buf = this.inject_requirejs(base_url, script_name, buf, null)
            ncontent += '<script>'
            ncontent += 'require(["vendors/go-device-preview/device-preview", "vendors/templater"], function(DevicePreviewFacade, templater){'
            ncontent +=         'templater().always(function(){'
            ncontent +=             'if( $(".device").length == 0 ){$("#stryke-db").before("<div class=\'device\'></div>")}'
            ncontent +=             'var DevicePreview = new DevicePreviewFacade($(".device"));'
            ncontent +=             'DevicePreview.EnableDevice("'+device+'");'
            ncontent +=             'DevicePreview.EnableDeviceMode("'+device_mode+'");'
            ncontent +=         '});'
            ncontent += '})'
            ncontent += '</script>'
            buf = buf.replace("</body>", ncontent+"</body>")
            return buf
        }
        this.inject_dashboard = function(base_url, script_name, buf){
            var ncontent = ""
            ncontent += "<div id='stryke-db'></div>"
            buf = this.inject_requirejs(base_url, script_name,  buf, /*"/js/vendors/go-dashboard.js"*/ null)
            ncontent += '<script>'
            ncontent += 'require(["vendors/go-dashboard/dashboard-ui"], function($){'
            ncontent +=     'window.setTimeout(function(){'
            ncontent +=         '$("#stryke-db")'
            ncontent +=         '.hide()'
            ncontent +=         '.load_dashboard("/js/vendors/go-dashboard/dashboard.html", function(){'
            ncontent +=             '$("#stryke-db").dashboard().css("opacity",0).show().animate({opacity:100},1000);'
            ncontent +=         '});'
            ncontent +=     '},500);'
            ncontent += '})'
            ncontent += '</script>'
            buf = buf.replace("</body>", ncontent+"</body>")
            return buf
        }
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

