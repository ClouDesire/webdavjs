// A raw WebDAV interface
(function() {
  var WebDAV = {
    useCredentials: false,

    GET: function(url, callback) {
      return this.request('GET', url, {}, null, 'text', callback);
    },

    PROPFIND: function(url, callback) {
      return this.request('PROPFIND', url, {Depth: "1"}, null, 'xml', callback);
    },

    MKCOL: function(url, callback) {
      return this.request('MKCOL', url, {}, null, 'text', callback);
    },

    DELETE: function(url, callback) {
      return this.request('DELETE', url, {}, null, 'text', callback);
    },

    PUT: function(url, data, callback) {
      return this.request('PUT', url, {}, data, 'text', callback);
    },

    request: function(verb, url, headers, data, type, callback) {
      var xhr = new XMLHttpRequest();
      xhr.withCredentials = this.useCredentials;
      var body = function() {
        var b = xhr.responseText;
        if (type == 'xml') {
          var xml = xhr.responseXML;
          if(xml) {
            b = xml.firstChild.nextSibling ? xml.firstChild.nextSibling : xml.firstChild;
          }
        }
        return b;
      };

      if(callback) {
        xhr.onreadystatechange = function() {
          if(xhr.readyState == 4) { // complete.
            var b = body();
            if(b) {
              callback(b);
            }
          }
        };
      }
      xhr.open(verb, url, !!callback);
      xhr.setRequestHeader("Content-Type", "text/xml; charset=UTF-8");
      for (var header in headers) {
        xhr.setRequestHeader(header, headers[header]);
      }
      xhr.send(data);

      if(!callback) {
        return body();
      }
    }
  };

  // An Object-oriented API around WebDAV.
  WebDAV.Fs = function(rootUrl) {
    this.rootUrl = rootUrl;
    var fs = this;

    this.file = function(href, size, mtime, hash) {
      this.type = 'file';

      this.size = size;
      this.mtime = mtime;
      // just for funzies
      this.hash = Math.pow(size * mtime, 13) % Number.MAX_SAFE_INTEGER;

      this.url = fs.urlFor(href);

      this.name = fs.nameFor(this.url);

      this.read = function(callback) {
        return WebDAV.GET(this.url, callback);
      };

      this.write = function(data, callback) {
        return WebDAV.PUT(this.url, data, callback);
      };

      this.rm = function(callback) {
        return WebDAV.DELETE(this.url, callback);
      };

      return this;
    };

    this.dir = function(href) {
      this.type = 'dir';

      this.url = fs.urlFor(href);

      this.name = fs.nameFor(this.url);

      this.children = function(callback) {
        var childrenFunc = function(doc) {
          if(doc.children == null) {
            throw('No such directory: ' + url);
          }

          var ns = 'DAV:';
          var result = [];
          // Start at 1, because the 0th is the same as self.
          for(var i=1; i< doc.children.length; i++) {
            var response     = doc.children[i];
            var href         = response.getElementsByTagNameNS(ns, 'href')[0].firstChild.nodeValue;
            href = href.replace(/\/$/, ''); // Strip trailing slash
            var propstat     = response.getElementsByTagNameNS(ns, 'propstat')[0];
            var prop         = propstat.getElementsByTagNameNS(ns, 'prop')[0];
            var resourcetype = prop.getElementsByTagNameNS(ns, 'resourcetype')[0];
            var collection   = resourcetype.getElementsByTagNameNS(ns, 'collection')[0];

            var size         = parseInt(prop.getElementsByTagNameNS(ns, 'getcontentlength')[0].innerHTML);
            var mtime        = new Date(prop.getElementsByTagNameNS(ns, 'getlastmodified')[0].innerHTML).getTime();

            if(collection) {
              result[i-1] = new fs.dir(href, size, mtime);
            } else {
              result[i-1] = new fs.file(href, size, mtime);
            }
          }
          return result;
        };

        if(callback) {
          WebDAV.PROPFIND(this.url, function(doc) {
            callback(childrenFunc(doc));
          });
        } else {
          return childrenFunc(WebDAV.PROPFIND(this.url));
        }
      };

      this.rm = function(callback) {
        return WebDAV.DELETE(this.url, callback);
      };

      this.mkdir = function(callback) {
        return WebDAV.MKCOL(this.url, callback);
      };

      return this;
    };

    this.urlFor = function(href) {
      return (/^http/.test(href) ? href : this.rootUrl + href);
    };

    this.nameFor = function(url) {
      return url.replace(/.*\/(.*)/, '$1');
    };

    return this;
  };

  // Export WebDAV
  // For requirejs
  if (window.define) {
    window.define(function (require, exports, module) {
      "use strict";

      for (var key in WebDAV) {
        exports[key] = WebDAV[key];
      }
    });
  }
  // For normal usage
  else {
    window.WebDAV = WebDAV;
  }

})();
