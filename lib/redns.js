'use strict';

const dns = require('dns');
const async = require('async');
const debug = require('debug')('redns');

// For later monkey-patching in user code
const dnsLookup = dns.lookup;

const DEFAULT_RETRIES = 8;
const DEFAULT_TIMEOUT = 100;

function ReDNS(options) {
  this.options = Object.assign({
    preferV4: true,
    retries: DEFAULT_RETRIES,
    timeout: DEFAULT_TIMEOUT,
    incrementalTimeout: true
  }, options);

  this.cache = new Map();
}
module.exports = ReDNS;

function Entry(records) {
  this.index = 0;
  this.records = records;
}

Entry.prototype.use = function use(all, callback) {
  const now = Date.now();
  const results = [];

  // No need in rotation when retrieving all records
  if (all)
    this.index = 0;

  const start = this.index;
  do {
    const record = this.records[this.index];
    this.index = (this.index + 1) % this.records.length;

    if (record.expiresAt > now) {
      results.push(record);
      if (!all)
        break;
    }
  } while (this.index !== start);

  if (results.length === 0) {
    debug('all expired');
    return false;
  }

  if (all)
    process.nextTick(callback, null, results);
  else
    process.nextTick(callback, null, results[0].address, results[0].family);

  return true;
};

// lookup(hostname, [options,] callback)
ReDNS.prototype.lookup = function lookup(hostname, options, callback) {
  let family = 0;
  let all = false;

  if (typeof options === 'function') {
    callback = options;
    options = 0;
  } else if (typeof options === 'object') {
    family = options.family >>> 0;
    all = options.all === true;
  } else {
    family = options >>> 0;
  }

  // TODO(indutny): use `options.hints`?
  const key = hostname + ':' + family + ':' + ':' + all;

  if (this.cache.has(key)) {
    debug('cache hit');
    // Try to reuse result if it isn't stale
    if (this.cache.get(key).use(all, callback))
      return;
  }

  debug('cache miss');

  const onresult = (err, records) => {
    if (err)
      return callback(err);

    const now = Date.now();

    // Unify records
    const unified = records.map((record) => {
      return {
        address: record.address,
        expiresAt: now + record.ttl * 1000,
        family: family || record.family
      };
    });

    const entry = new Entry(unified);

    if (entry.use(all, callback)) {
      debug('cache store');
      this.cache.set(key, entry);
      return;
    }

    // Fallback
    debug('fallback');
    dnsLookup(hostname, options, callback);
  };

  if (family === 0) {
    this._resolveBoth(hostname, all, onresult);
  } else if (family === 4) {
    this._resolve(hostname, 4, onresult);
  } else if (family === 6) {
    this._resolve(hostname, 6, onresult);
  } else {
    debug('fallback');
    // Fallback, intentional use of `callback` here
    dnsLookup(hostname, options, callback);
  }
};

ReDNS.prototype._resolve = function _resolve(hostname, family, callback) {
  const options = { ttl: true };
  const resolver = family === 4 ? dns.resolve4 : dns.resolve6;

  let timeout = this.options.timeout;

  async.retry({ times: this.options.retries }, (callback) => {
    let done = false;
    const timer = setTimeout(() => {
      debug(`query timed out ${hostname}:${family} after ${timeout}ms`);

      if (this.options.incrementalTimeout)
        timeout *= 2;

      done = true;
      callback(new Error('DNS query timed out'));
    }, timeout);

    resolver(hostname, options, (err, results) => {
      // Timed out
      if (done)
        return;

      done = true;
      clearTimeout(timer);
      if (err)
        return callback(err);

      callback(null, results.map((result) => {
        if (typeof result === 'string')
          return { address: result, ttl: Infinity, family };

        return { address: result.address, ttl: result.ttl, family };
      }));
    });
  }, callback);
};

ReDNS.prototype._resolveBoth = function _resolveBoth(hostname, all, callback) {
  const wrap = (callback) => {
    return (err, results) => {
      if (err) {
        if (err.code === 'ENODATA')
          return callback(null, []);
        else
          return callback(err);
      }

      return callback(null, results);
    };
  };

  async.parallel({
    a: callback => this._resolve(hostname, 4, wrap(callback)),
    aaaa: callback => this._resolve(hostname, 6, wrap(callback))
  }, (err, results) => {
    if (err)
      return callback(err);

    if (results.a.length === 0 && results.aaaa.length === 0)
      return callback(new Error('No DNS query results'));

    // Node.js prefers V4 addresses in default `dns.lookup` implementation
    if (!all && this.options.preferV4 && results.a.length)
      return callback(null, results.a);
    else
      return callback(null, results.a.concat(results.aaaa));
  });
};
