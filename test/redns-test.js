'use strict';
/* global describe it */

const assert = require('assert');
const async = require('async');
const net = require('net');

const ReDNS = require('../');

describe('redns', () => {
  it('should lookup github.com', (cb) => {
    const r = new ReDNS();

    r.lookup('github.com', (err, first, family) => {
      assert.ok(!err);
      assert.equal(family, 4);
      assert.ok(net.isIPv4(first));

      r.lookup('github.com', (err, second, family) => {
        assert.ok(!err);
        assert.equal(family, 4);
        assert.ok(net.isIPv4(second));
        assert.notEqual(first, second);

        cb();
      });
    });
  });

  it('should respect `all: true` option', (cb) => {
    const r = new ReDNS();

    r.lookup('www.google.com', { all: true }, (err, results) => {
      assert.ok(!err);

      assert(results.length > 0);

      let seenV4 = 0;
      let seenV6 = 0;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.family === 4) {
          assert.equal(seenV6, 0);
          seenV4++;
        } else {
          assert.equal(result.family, 6);
          assert.notEqual(seenV4, 0);
          seenV6++;
        }
      }
      cb();
    });
  });

  it('should respect `family` option', (cb) => {
    const r = new ReDNS();

    r.lookup('www.google.com', 4, (err, result, family) => {
      assert.ok(!err);

      assert.ok(net.isIPv4(result));
      assert.equal(family, 4);
      cb();
    });
  });

  it('should merge parallel queries', (cb) => {
    const r = new ReDNS();

    async.parallel([
      cb => r.lookup('github.com', 4, (err, addr) => cb(err, addr)),
      cb => r.lookup('github.com', 4, (err, addr) => cb(err, addr))
    ], (err, results) => {
      assert.ok(!err);
      assert.equal(results.length, 2);
      assert.notEqual(results[0], results[1]);

      assert.ok(net.isIPv4(results[0]));
      assert.ok(net.isIPv4(results[1]));
      cb();
    });
  });

  it('should add semi-permanent fallback on no A records', (cb) => {
    const r = new ReDNS();

    const host = 'noa.darksi.de';

    async.parallel([
      cb => r.lookup(host, 4, (err, addr) => cb(err, addr)),
      cb => r.lookup(host, 4, (err, addr) => cb(err, addr))
    ], (err) => {
      assert.ok(err);
      cb();
    });
  });
});
