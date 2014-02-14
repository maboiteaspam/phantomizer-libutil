var Phantomizer = require(__dirname+"/Phantomizer.js")
module.exports = {
  html_utils:require('./html_utils.js').html_utils,
  http_utils:require('./http_utils.js').http_utils,
  phantomizer_helper:require('./phantomizer_helper.js').phantomizer_helper,
  file_utils:require('./file_utils.js').file_utils,
  webserver:require('./webserver.js').webserver,
  instances:{},
  main: function() {
    return this.instances["main"];
},
get: function(name) {
  return this.instances[name];
},
register: function(name,cwd,grunt) {
  this.instances[name] = new Phantomizer(cwd,grunt);
  return this.instances[name];
}
};