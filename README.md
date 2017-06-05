# ReDNS

A drop-in replacement for `dns.lookup` that can:

* Cache records with TTL
* Rotate records
* Perform retries of dns query with incremental timeouts

## Usage

```js
const ReDNS = require('redns');

const r = new ReDNS({
  /* Default values listed below */

  // When doing lookup with unspecified family - prefer A records
  // over AAAA records (as node.js does by default)
  preferV4: true,

  // Number of retries in case of DNS query error
  retries: 8,

  // DNS query timeout
  timeout: 100,

  // If `true` - double timeout on every retry
  incrementalTimeout: true
});

// API is absolutely the same as with `dns.lookup`
r.lookup('www.google.com', (err, result, family) => {
});
```

## LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2017.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.
