
(function(exports) {
	
	var html_utils = function(){

        function get_src_attr(html_content){
            return get_attr("href|src", html_content)
        }
        function get_attr(attr, html_content){
            var retour = ""
            var src_ptn = new RegExp("("+attr+")\s*=\s*['\"]?([^'\"]+)['\"]?", "i")
            var src = html_content.match(src_ptn)
            if( src != null && src.length>0){
                retour = src[2]
            }
            return retour
        }
        function get_script_nodes(html_content){
            var retour = []
            var ptn = /(<script[^>]*?\/?>[^<]*?<\/script>)/gi
            var nodes = html_content.match(ptn)
            if( nodes != null ){
                retour = nodes
            }
            return retour
        }
        function get_img_nodes(html_content){
            var retour = []
            var ptn = /(<img[^>]+\/?>)/gi
            var nodes = html_content.match(ptn)
            if( nodes != null ){
                retour = nodes
            }
            return retour
        }
        function get_style_nodes(html_content){
            var retour = []
            var ptn = /(<style[^>]*?\/?>[^<]*?<\/style>)/gim
            var nodes = html_content.match(ptn)
            if( nodes != null ){
                retour = nodes
            }
            return retour
        }
        function get_link_nodes(html_content){
            var retour = []
            var ptn = /(<link[^>]+\/?>([^<]*?<\/link>)?)/gi
            var style_ptn = new RegExp("rel\s*=\s*['\"]?stylesheet['\"]?", "gi")
            var nodes = html_content.match(ptn)
            if( nodes != null ){
                for( var n in nodes ){
                    if( nodes[n].match(style_ptn) ){
                        retour.push(nodes[n])
                    }
                }
            }
            return retour
        }
        function get_css_imports(css_content){
            var retour = []
            var import_ptn = new RegExp("@import[^;]+;", "gi")
            var imports = css_content.match(import_ptn)
            if( imports != null ){
                retour = imports
            }
            return retour
        }
        function get_css_bg(css_content){
            var retour = []
            var import_ptn = new RegExp("background(-image)?\\s*:[^;]+;", "gi")
            var imports = css_content.match(import_ptn)
            if( imports != null ){
                retour = imports
            }
            return retour
        }
        function get_rule_src(css_import){
            var retour = ""
            var src_ptn = new RegExp("(url)?([(]['\"]([^'\"]+)['\"][)])|([(]([^)]+)[)])|(['\"]([^'\"]+)['\"])", "i")
            var rule_src = css_import.match(src_ptn)

            if( rule_src != null ){
                if( rule_src.length > 6 ){
                    if( rule_src[7] ){
                        retour = rule_src[7]
                    }
                    if( rule_src[3] ){
                        retour = rule_src[3]
                    }
                }
            }

            return retour
        }

        this.style_node_bysrc = function(nodes, src){
            var nodes_list = [];
            for(var n in this ){
                for( var t in this[n]["imgs"] ){
                    if( this[n]["imgs"][t].src == src
                        || this[n]["imgs"][t].asrc == src ){
                        nodes_list.push(this[n])
                    }
                }
                for( var t in this[n]["imports"] ){
                    if( this[n]["imports"][t].src == src
                        || this[n]["imports"][t].asrc == src ){
                        nodes_list.push(this[n])
                    }
                }
            }
            return nodes_list
        };
        this.node_by_src = function(nodes, src){
            var nodes_list = [];
            for(var n in nodes ){
                //console.log(src, nodes[n].asrc)
                if( nodes[n].src == src
                    || nodes[n].asrc == src ){
                    nodes_list.push(nodes[n])
                }
            }
            return nodes_list
        };

		this.find_style_nodes = function(html_content, base_url){
            var retour = []

			var nodes = get_style_nodes(html_content)
            for( var n in nodes ){
                var css_imports = this.find_import_rules(nodes[n], base_url)
                var css_imgs = this.find_img_rules(nodes[n], base_url)
                if( css_imports.length > 0 || css_imgs.length > 0 ){
                    retour.push({
                        'node':nodes[n],
                        'imports':css_imports,
                        'imgs':css_imgs
                    })
                }
            }

			return retour
		};

		this.find_link_nodes = function(html_content, base_url){
            var retour = []

			var nodes = get_link_nodes(html_content)
            for( var n in nodes ){
                var src = get_src_attr(nodes[n])
                if( src != ""){
                    var has_domain = false
                    var asrc = src

                    has_domain = asrc.substring(0,7)=="http://" || asrc.substring(0,8)=="https://"

                    if( !has_domain && asrc.substring(0,1) != "/" ){
                        asrc = base_url+asrc
                    }
                    retour.push({
                        'node':nodes[n],
                        'has_domain':has_domain,
                        'asrc':asrc,
                        'src':src
                    })
                }
            }
			
			return retour
		};

		this.find_rjs_nodes = function(html_content, requirejs_src, base_url){
            var retour = []

            var nodes = get_script_nodes(html_content)
            for( var n in nodes ){
                var src_ = get_src_attr(nodes[n]) // require js script src
                if( src_== base_url+requirejs_src ){
                    var main = get_attr("data-main", nodes[n]) // module script src
                    var has_domain = false
                    var asrc = src_
                    var src = src_

                    if( main!= "" ){
                        src = asrc = main
                    }

                    has_domain = asrc.substring(0,7)=="http://" || asrc.substring(0,8)=="https://"

                    if( !has_domain && asrc.substring(0,1) != "/" ){
                        asrc = base_url+asrc
                    }

                    if( main!= "" ){
                        var rbase_url = requirejs_src.substring(0,requirejs_src.lastIndexOf("/")+1)
                        if( rbase_url.substring(0,1) != "/" ){
                            rbase_url = base_url+rbase_url
                        }
                        main = asrc
                        main = main.replace(rbase_url, "")
                        main = main.replace(".js", "")
                    }

                    retour.push({
                        'node':nodes[n],
                        'has_domain':has_domain,
                        'asrc':asrc,
                        'src':src,
                        'main':main
                    })
                }
            }

			return retour
		};

        this.find_scripts_nodes = function(html_content, base_url, any){
            var retour = []

            var nodes = get_script_nodes(html_content)
            for( var n in nodes ){
                var src = get_src_attr(nodes[n])
                if( src!= "" ){
                    if( get_attr("data-main", nodes[n]) == "" || any == true ){
                        var has_domain = false
                        var asrc = src

                        has_domain = asrc.substring(0,7)=="http://" || asrc.substring(0,8)=="https://"

                        if( !has_domain && asrc.substring(0,1) != "/" ){
                            asrc = base_url+asrc
                        }
                        retour.push({
                            'node':nodes[n],
                            'has_domain':has_domain,
                            'asrc':asrc,
                            'src':src
                        })
                    }
                }
            }

            return retour
        };


        this.find_img_nodes = function(html_content, base_url){
            var retour = []

            var nodes = get_img_nodes(html_content)
            for( var n in nodes ){
                var src = get_src_attr(nodes[n])
                if( src!= "" ){
                    var has_domain = false
                    var asrc = ""
                    var asrc = src

                    has_domain = asrc.substring(0,7)=="http://" || asrc.substring(0,8)=="https://"

                    if( !has_domain && asrc.substring(0,1) != "/" ){
                        asrc = base_url+asrc
                    }
                    retour.push({
                        'node':nodes[n],
                        'has_domain':has_domain,
                        'asrc':asrc,
                        'src':src
                    })
                }
            }

            return retour
        };

        this.find_img_rules = function(css_content, base_url){
            var retour = []

            var back_grd = get_css_bg(css_content)

            for( var i in back_grd ){
                var src = get_rule_src(back_grd[i])

                if( src != "" ){
                    var has_domain = false
                    var asrc = src

                    has_domain = asrc.substring(0,7)=="http://" || asrc.substring(0,8)=="https://"

                    if( !has_domain && asrc.substring(0,1) != "/" ){
                        asrc = base_url+asrc
                    }

                    retour.push({
                        "img":back_grd[i],
                        "has_domain":has_domain,
                        "asrc":asrc,
                        "src":src
                    })
                }
            }


            return retour
        };

        this.find_import_rules = function(css_content, base_url){
            var retour = []

            var imports = get_css_imports(css_content)

            for( var i in imports ){
                var src = get_rule_src(imports[i])

                if( src != "" ){
                    var has_domain = false
                    var asrc = src

                    has_domain = asrc.substring(0,7)=="http://" || asrc.substring(0,8)=="https://"

                    if( !has_domain && asrc.substring(0,1) != "/" ){
                        asrc = base_url+asrc
                    }

                    retour.push({
                        "import":imports[i],
                        "has_domain":has_domain,
                        "asrc":asrc,
                        "src":src
                    })
                }
            }


            return retour
        };


        this.append_css = function(css_src, html_content){
            var n_node = "<link rel=\"stylesheet\" href=\""+css_src+"\" type=\"text/css\" media=\"screen\" />"
            var anchor = ""
            if( html_content.indexOf("</body>") > -1 ){
                anchor = "</body>"
            }else if( html_content.indexOf("</html>") > -1 ){
                anchor = "</html>"
            }

            if( anchor == "" ){
                html_content += n_node
            }else{
                html_content = html_content.replace(anchor,n_node+anchor)
            }

            return html_content
        };
        this.prepend_css = function( css_src, html_content, anchor ){
            var n_node = "<link rel=\"stylesheet\" href=\""+css_src+"\" type=\"text/css\" media=\"screen\" />"
            if( anchor == "" ){
                if( html_content.indexOf("</head>") > -1 ){
                    anchor = "</head>"
                }else if( html_content.indexOf("<body>") > -1 ){
                    anchor = "<body>"
                }
            }

            if( anchor == "" ){
                html_content += n_node
            }else{
                html_content = html_content.replace(anchor,n_node+anchor)
            }

            return html_content
        }
        this.append_script = function( script_src, html_content ){
            var n_node = "<script src='"+script_src+"'></script>"
            var anchor = ""
            if( html_content.indexOf("</body>") > -1 ){
                anchor = "</body>"
            }else if( html_content.indexOf("</html>") > -1 ){
                anchor = "</html>"
            }

            if( anchor == "" ){
                html_content += n_node
            }else{
                html_content = html_content.replace(anchor,n_node+anchor)
            }

            return html_content
        }
        this.prepend_script = function( script_src, html_content, anchor ){
            var n_node = "<script src='"+script_src+"'></script>"
            if( anchor == "" ){
                if( html_content.indexOf("</body>") > -1 ){
                    anchor = "</body>"
                }else if( html_content.indexOf("</html>") > -1 ){
                    anchor = "</html>"
                }
            }

            if( anchor == "" ){
                html_content += n_node
            }else{
                html_content = html_content.replace(anchor,n_node+anchor)
            }

            return html_content
        }
        this.strip_scripts = function(strip_scripts, html_content, base_url ){
            var scripts = this.find_scripts_nodes(html_content, base_url)
            for( var n in strip_scripts ){
                var striped = strip_scripts[n]
                var node = this.node_by_src(scripts, striped)
                if( node.length > 0 ){
                    for(var t in node){
                        html_content = html_content.replace(node[t].node,"")
                    }
                }
            }
            return html_content
        }
        this.script_anchor = function(html_content, base_url){
            var anchor = ""
            var _scripts = this.find_scripts_nodes(html_content, base_url, true)
            if( _scripts.length > 0 ) anchor = _scripts[0].node
            return anchor
        }
        this.strip_css = function(strip_css, html_content, base_url ){
            var nodes = this.find_link_nodes(html_content, base_url)
            for( var n in strip_css ){
                var striped = strip_css[n]
                var node = this.node_by_src(nodes, striped)
                if( node.length > 0 ){
                    for(var t in node){
                        html_content = html_content.replace(node[t].node,"")
                    }
                }
            }
            nodes = this.find_style_nodes(html_content, base_url)
            for(var k in nodes ){
                for( var n in strip_css ){
                    var striped = strip_css[n]
                    var node = this.node_by_src(nodes[k].imports, striped)
                    if( node.length > 0 ){
                        for(var t in node){
                            html_content = html_content.replace(node[t].import,"")
                        }
                    }
                }
            }
            return html_content
        }
        this.css_anchor = function(html_content, base_url){
            var anchor = ""
            var anchorp = 0
            var _link = this.find_link_nodes(html_content, base_url, true)
            if( _link.length > 0 ){
                if(html_content.indexOf(_link[0].node) > anchorp){
                    anchorp = html_content.indexOf(_link[0].node)
                    anchor = _link[0].node
                }
            }
            var _style = this.find_style_nodes(html_content, base_url, true)
            if( _style.length > 0 ){
                if(html_content.indexOf(_style[0].node) > anchorp){
                    anchor = _style[0].node
                }
            }
            return anchor
        }
	};
	
	
  // Expose the constructor function.
  exports.html_utils = new html_utils();
}(typeof exports === 'object' && exports || this));

