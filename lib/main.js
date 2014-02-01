
(function(){
// The module to be exported.
    var libutil = {
        'meta':null,
        'html_utils':null,
        'http_utils':null,
        'optimizer':null,
        'phantomizer_helper':null,
        'router':null,
        'file_utils':null,
        'delivery_queue':null,
        'webserver':null
    };

    for( var name in libutil ){
        var t = require('./' + name + '.js');
        libutil[name] = t[name]?t[name]:t
    }
    module.exports = libutil;
})()
