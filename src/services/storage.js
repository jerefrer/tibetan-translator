export default {
  appName: 'tibetan-translator',
  localStorageSupported: function() {
    try { return !!window.localStorage; }
    catch(error) { return false };
    return true;
  },
  scopedKey: function(keyName) {
    return this.appName + '.' + keyName;
  },
  get: function(keyName) {
    var jsonValue;
    var key = this.scopedKey(keyName);
    if (this.localStorageSupported())
      jsonValue = localStorage[key];
    else
      jsonValue = Cookie.read(key);
    return jsonValue && JSON.parse(jsonValue);
  },
  set: function(keyName, value) {
    var key = this.scopedKey(keyName);
    if (value == undefined) {
      this.delete(keyName);
      return;
    }
    var jsonValue = JSON.stringify(value);
    if (this.localStorageSupported())
      localStorage[key] = jsonValue;
    else {
      var tenYears = 87600;
      Cookie.write(key, jsonValue, tenYears);
    }
    return true;
  },
  delete: function(keyName) {
    var key = this.scopedKey(keyName);
    if (this.localStorageSupported())
      delete localStorage[key];
    else {
      Cookie.remove(key);
    }
  }
}

var Cookie = {
  write: function(name, value, hours) {
      let expire = '';
      if (hours) {
          expire = new Date((new Date()).getTime() + hours * 3600000);
          expire = '; expires=' + expire.toGMTString();
      }
      document.cookie = name + '=' + escape(value) + expire;
  },
  read: function(name) {
      let cookieValue = '',
          search = name + '=';
      if (document.cookie.length > 0) {
          let cookie = document.cookie,
              offset = cookie.indexOf(search);
          if (offset !== -1) {
              offset += search.length;
              let end = cookie.indexOf(';', offset);
              if (end === -1) {
                  end = cookie.length;
              }
              cookieValue = unescape(cookie.substring(offset, end));
          }
      }
      return cookieValue;
  },
  remove: function(name) {
      this.write(name, '', -1);
  }
}