var express = require('express');
var router = express.Router();
var basex = require('../db');
var cheerio = require('cheerio');
var _ = require('underscore');

/* GET search page. */
router.get('/*/view', function(req, res, next) {
  var url = req.url.replace(/\/view\/?/, '');
  basex.getDocument(url + ".xml", function(err, doc) {
    if (err) console.log(err);
    var crumbs = breadcrumbs(req.url.replace(/\/view\/?$/, ''), req.baseUrl);
    crumbs.unshift({title: 'Browse', url: req.baseUrl});
    var teiDoc = teiToObject(doc);
    crumbs[crumbs.length - 1] = teiDoc.title;
    res.render('view', { title: 'Colenso - Browse - ' + teiDoc.title, doc: teiDoc, crumbs: crumbs, download_url: req.baseUrl + url + '.xml' });
  });
});

router.get('/*/edit', function(req, res, next) {
  var url = req.url.replace(/\/edit\/?/, '');
  basex.getDocument(url + ".xml", function(err, doc) {
    if (err) console.log(err);
    var crumbs = breadcrumbs(req.url.replace(/\/edit\/?$/, ''), req.baseUrl);
    crumbs.unshift({title: 'Browse', url: req.baseUrl});
    var teiDoc = teiToObject(doc);
    crumbs[crumbs.length - 1] = teiDoc.title;
    res.render('edit', { title: 'Colenso - Eidtting ' + teiDoc.title, docTitle: teiDoc.title, doc: doc, crumbs: crumbs, edit_url: req.originalUrl });
  });
});

router.post('/*/edit', function(req, res, next) {
  var url = req.url.replace(/\/edit\/?/, '');
  basex.execute('open colenso', function(err, data) {
    if (err) {
      res.redirect(req.originalUrl);
    }
    basex.execute('REPLACE ' + url.replace(/^\/browse/,'') + '.xml ' + req.body.doc, function (err, data) {
      if (err) {
        res.redirect(req.originalUrl);
      }
      res.redirect(req.baseUrl + url + '/view');
    });
  });
});

router.get('/*/download', function(req, res, next) {
  var url = req.url.replace(/\/download\/?/, '.xml');
  basex.getDocument(url, function(err, doc) {
    if (err) console.log(err);
    var name = _.last(url.split('/'));
    res.setHeader('Content-disposition', 'attachment; filename=' + name);
    res.setHeader('Content-type', 'text/xml');

    res.write(doc, 'utf-8');
    res.end();
  });
});

// GET all files that are stored using this
router.get('/*', function(req, res, next) {
  basex.foldersInPath (req.url, function(err, data) {
    if (err) console.log(err);
    req.originalUrl = req.originalUrl.replace(/\/$/,'');
    var list = _.map(data, function(ele) {
      return {
        url: req.originalUrl + '/' + ele.path.replace(/\.xml$/, '/view'),
        title: ele.title,
        glyph: ele.path.indexOf('.xml') > -1 ? 'glyphicon-file' : 'glyphicon-folder-close',
      };});
      var crumbs = breadcrumbs(req.url, req.baseUrl);
      if (req.baseUrl !== req.originalUrl) {
        crumbs.unshift({title: 'Browse', url: req.baseUrl});
      }

      list = list.sort(function(a,b) { return a.title < b.title ? -1 : 1; });
      var title = 'Colenso - Browse';
      if (_.last(crumbs)) {
        title = title + ' - ' + _.last(crumbs);
      }
      var back = crumbs[crumbs.length - 2];
      back = back ? back.url : '/';
      res.render('browse', { title: title, list: list, crumbs: crumbs, back: back });
  });
});

function breadcrumbs(url, baseUrl) {
  return _.map(_.compact(url.split('/')), function(val, index, list) {
    val = val.replace(/_/g, ' ');
    if (index + 1 == list.length) {
      return val;
    }
    var url = baseUrl;
    for (var i = 0; i <= index; i++) {
      url = url + '/' + list[i];
    }
    return { title: val, url:  url};
  });
}

function teiToObject(doc) {
  $ = cheerio.load(doc);

  var author = $('<ul>');
  $('titleStmt author name').each(function(i, elem) {
    var item = $('<li>')
    .attr('class', 'authors')
    .append('<span class="glyphicon glyphicon-user" />')
    .append('<span> ' + $(this).text() + '</span>');
    author.append(item);
  });

  var correspDesc = {};
  $('correspDesc').find('correspAction').each(function(i, ele) {
    var obj = {
      date: $(this).find('date').text(),
      place: $(this).find('name[type="place"]').text(),
      person: $(this).find('name[type="person"]').text()
    };

    if ($(this).attr('type') === 'sent') {
      correspDesc.sent = obj;
    } else if ($(this).attr('type') === 'received') {
      correspDesc.recieve = obj;
    } else {
      console.log("Unimplemented correspAction type " + $(this).attr('type'));
    }
  });

  return { 
    title: $('title').text(),
    sourceDesc: $('sourceDesc').html(),
    correspDesc: correspDesc,
    author: author.html(),
    front: $('text front').html(),
    body: $('text body').html(),
  };
}

module.exports = router;
