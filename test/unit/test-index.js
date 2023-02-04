'use strict';

const {expect} = require('chai');
const httpsRateLimit = require('https-rate-limit');

const testModuleRef = {};
testModuleRef.request = (options, response) => {
  const req = {};
  req.headers = {};
  req.statusCode = 200;
  const onFns = {};
  req.on = (fnName, fn) => {
    onFns[fnName] = fn;
  };
  req.write = (body) => {
    const bodyJson = JSON.parse(body);
    // console.log('write', 'body', body);
    const fn = onFns['data'];
    if (fn) {
      const retvalJson = {};
      if (bodyJson.action = 'account_history') {
      }
      if (bodyJson.action = 'account_info') {
      }
      // console.log('write', 'retvalJson', retvalJson);
      fn(JSON.stringify(retvalJson));
    }
  };
  req.end = () => {
    // console.log('end', 'onFns', onFns);
    const fn = onFns['end'];
    if (fn) {
      fn();
    }
  };
  response(req);
  return req;
};

describe('index', () => {
  it('sendRequest', () => {
    try {
      httpsRateLimit.setUrl('https://localhost');
      httpsRateLimit.setUrl('http://localhost');
      httpsRateLimit.setModuleRef(testModuleRef);
      const historyChunkSize = 0;
      // const timeChunkFn = (ts) => {
      //   return ts;
      // };
      expect(historyChunkSize).to.equal(0);
    } catch (error) {
      console.trace(error);
    }
  });
});
