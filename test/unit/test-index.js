'use strict';

const {expect} = require('chai');
const index = require('../../index.js');
const httpsRateLimit = require('https-rate-limit');

const testModuleRef = {};
testModuleRef.request = (options, response) => {
  const retvalJson1 = {
    next: '2',
    history: [
      {
        type: 'state',
        subtype: 'send',
        hash: '1',
        account: 'a',
      },
      {
        type: 'state',
        subtype: 'send',
        hash: '2',
        account: 'b',
      },
      {
        type: 'state',
        subtype: 'receive',
        hash: '3',
        account: 'c',
      },
      {
        type: 'state',
        subtype: 'receive',
        hash: '3',
        account: 'c',
      },
      {
        type: 'state',
        subtype: 'receive',
        hash: '4',
        account: 'e',
      },
    ],
  };
  const retvalJson2 = {
    history: [
    ],
  };
  const retvalJson3 = {
    representative: 'ban_1tipbotgges3ss8pso6xf76gsyqnb69uwcxcyhouym67z7ofefy1jz7kepoy',
  };
  const retvalJson4 = {
    history: [
      {
        type: 'state',
        subtype: 'receive',
        hash: '5',
        account: 'a',
      },
    ],
  };
  const retvalJson5 = {
    history: [
      {
        type: 'state',
        subtype: 'receive',
        hash: '5',
        account: 'b',
      },
    ],
  };
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
      let retvalJson = {};
      if (bodyJson.action = 'account_history') {
        if (bodyJson.account == 'd') {
        } else {
          if (bodyJson.head) {
            retvalJson = retvalJson2;
          } else {
            if (bodyJson.account == 'c') {
              retvalJson = retvalJson4;
            } else if (bodyJson.account == 'b') {
              retvalJson = retvalJson5;
            } else {
              retvalJson = retvalJson1;
            }
          }
        }
      }
      if (bodyJson.action = 'account_info') {
        if (bodyJson.account == 'c') {
          retvalJson = retvalJson3;
        }
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
  it('sendRequest', async () => {
    try {
      httpsRateLimit.setUrl('https://localhost');
      httpsRateLimit.setUrl('http://localhost');
      httpsRateLimit.setModuleRef(testModuleRef);
      const historyChunkSize = 0;
      const timeChunkFn = (ts) => {
        return ts;
      };
      const amountByTimeChunkAndSrcDestTypeMap = new Map();
      const whalewatch = [];
      const knownAccountTypeMap = new Map();
      knownAccountTypeMap.set('a', 'exchange');
      knownAccountTypeMap.set('b', 'exchange');
      const debug = false;
      await index.getDistributionOverTime(httpsRateLimit, historyChunkSize, timeChunkFn, knownAccountTypeMap, 'a', amountByTimeChunkAndSrcDestTypeMap, whalewatch, debug, false);
      await index.getDistributionOverTime(httpsRateLimit, historyChunkSize, timeChunkFn, knownAccountTypeMap, 'b', amountByTimeChunkAndSrcDestTypeMap, whalewatch, debug, false);
      await index.getDistributionOverTime(httpsRateLimit, historyChunkSize, timeChunkFn, knownAccountTypeMap, 'c', amountByTimeChunkAndSrcDestTypeMap, whalewatch, debug, false);
      await index.getDistributionOverTime(httpsRateLimit, historyChunkSize, timeChunkFn, knownAccountTypeMap, 'd', amountByTimeChunkAndSrcDestTypeMap, whalewatch, debug, false);
      await index.getDistributionOverTime(httpsRateLimit, historyChunkSize, timeChunkFn, knownAccountTypeMap, 'a', amountByTimeChunkAndSrcDestTypeMap, whalewatch, true, false);
      await index.getDistributionOverTime(httpsRateLimit, historyChunkSize, timeChunkFn, knownAccountTypeMap, 'd', amountByTimeChunkAndSrcDestTypeMap, whalewatch, true, false);
      expect(amountByTimeChunkAndSrcDestTypeMap.size).to.equal(1);
    } catch (error) {
      console.trace(error);
    }
  });
});
