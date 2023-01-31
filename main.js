'use strict';
const fs = require('fs');
const readline = require('readline');
// const path = require('path');

const httpsRateLimit = require('https-rate-limit');
const rocksdb = require('rocksdb');

const DEBUG = false;
const VERBOSE = false;

const ZEROS = '0000000000000000000000000000000000000000000000000000000000000000';

const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const run = async () => {
  console.log('banano-timestamp-checker');


  if (process.argv.length < 4) {
    console.log('#usage:');
    console.log('npm start <infile> <outfile> <url>');
    return;
  }

  const timestampFileName = process.argv[2];
  const outFileNm = process.argv[3];
  const url = process.argv[4];

  httpsRateLimit.setUrl(url);

  const fileStream = fs.createReadStream(timestampFileName);

  const timestampLines = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });


  const db = rocksdb('data');
  const timestampCacheByHashMap = {};
  let minKey = undefined;
  let maxKey = undefined;
  const updateRange = async (key) => {
    if (minKey == undefined) {
      minKey = key;
    } else {
      if (minKey.localeCompare(key) > 0) {
        minKey = key;
      }
    }
    if (maxKey == undefined) {
      maxKey = key;
    } else {
      if (maxKey.localeCompare(key) < 0) {
        maxKey = key;
      }
    }
    if (await timestampCacheByHashMap.hasget('minKey') != minKey) {
      await timestampCacheByHashMap.put('minKey', minKey, true);
    }
    if (await timestampCacheByHashMap.hasget('maxKey') != maxKey) {
      await timestampCacheByHashMap.put('maxKey', maxKey, true);
    }
  };
  timestampCacheByHashMap.dbOpen = () => {
    return new Promise((resolve, reject) => {
      db.open((error) => {
        /* istanbul ignore if */
        if (error !== undefined) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };

  timestampCacheByHashMap.dbClose = () => {
    return new Promise((resolve, reject) => {
      db.close((error) => {
        /* istanbul ignore if */
        if (error !== undefined) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };

  timestampCacheByHashMap.has = async (key) => {
    if (key === undefined) {
      throw new Error('key is required');
    }
    const keyStr = key.toString();
    return new Promise((resolve, reject) => {
      try {
        db.get(keyStr, function(err, value) {
          /* istanbul ignore if */
          if (err && err.code === 'LEVEL_NOT_FOUND') {
            resolve(false);
          } else if (value === undefined) {
            resolve(false);
          } else {
            resolve(true);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  timestampCacheByHashMap.get = async (key) => {
    if (key === undefined) {
      throw new Error('key is required');
    }
    const keyStr = key.toString();
    return new Promise((resolve, reject) => {
      try {
        db.get(keyStr, function(err, value) {
          /* istanbul ignore if */
          if (err && err.code === 'LEVEL_NOT_FOUND') {
            reject(Error(`code:${err.code}`));
          } else if (value === undefined) {
            reject(Error(`value UNDEFINED`));
          } else {
            resolve(value.toString());
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  timestampCacheByHashMap.put = async (key, value, skipRangeUpdate) => {
    if (key === undefined) {
      throw new Error('key is required');
    }
    if (value === undefined) {
      throw new Error('key is required');
    }
    const keyStr = key.toString();
    if (skipRangeUpdate != true) {
      await updateRange(keyStr);
    }
    const valueStr = value.toString();
    return new Promise((resolve, reject) => {
      try {
        db.put(keyStr, valueStr, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(null);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  timestampCacheByHashMap.del = async (key) => {
    if (key === undefined) {
      throw new Error('key is required');
    }
    const keyStr = key.toString();
    await updateRange(keyStr);
    return new Promise((resolve, reject) => {
      try {
        db.del(keyStr, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(null);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  timestampCacheByHashMap.size = () => {
    if ((minKey == undefined) || (maxKey == undefined)) {
      return 0;
    }
    return new Promise((resolve, reject) => {
      db.approximateSize(minKey, maxKey, (error, size) => {
        /* istanbul ignore if */
        if (error) {
          reject(error);
        } else {
          resolve(size);
        }
      });
    });
  };
  timestampCacheByHashMap.hasget = async (key) => {
    if (await timestampCacheByHashMap.has(key)) {
      return await timestampCacheByHashMap.get(key);
    }
  };

  await timestampCacheByHashMap.dbOpen();
  console.log('timestampCacheByHashMap.size', timestampCacheByHashMap.size());
  if (await timestampCacheByHashMap.has('minKey')) {
    minKey = await timestampCacheByHashMap.get('minKey');
  }
  if (await timestampCacheByHashMap.has('maxKey')) {
    maxKey = await timestampCacheByHashMap.get('maxKey');
  }


  const zeroTimestampHashSet = new Set();
  const zeroTimestampAccountSet = new Set();

  // if (VERBOSE) {
  // console.log('timestampLines.length', timestampLines.length);
  // }

  const clearLines = () => {
    const outFilePtr = fs.openSync(outFileNm, 'w');
    fs.closeSync(outFilePtr);
  };

  const appendLine = (line) => {
    const outFilePtr = fs.openSync(outFileNm, 'a');
    fs.writeSync(outFilePtr, line);
    fs.writeSync(outFilePtr, '\n');
    fs.closeSync(outFilePtr);
  };

  clearLines();

  const fn = async () => {
    let time = 0;
    let lineIx = 0;
    for await (const timestampLine of timestampLines) {
      // console.log('timestampLine', lineIx);
      try {
        if (Date.now() > time + 10000) {
          console.log('timestampLine', lineIx,
              'cache.size', formatBytes(await timestampCacheByHashMap.size()),
              'minKey', await timestampCacheByHashMap.hasget('minKey'),
              'maxKey', await timestampCacheByHashMap.hasget('maxKey'));
          time = Date.now();
          await timestampCacheByHashMap.dbClose();
          await timestampCacheByHashMap.dbOpen();
        }
        if (DEBUG) {
          if (lineIx > 1000) {
            return;
          }
        }
        if (timestampLine.length !== 0) {
          const timestampData = timestampLine.split(',');
          const hash = timestampData[0];
          const timestamp = timestampData[1];
          if (BigInt(timestamp) == BigInt(0)) {
            zeroTimestampHashSet.add(hash);
          } else {
            await timestampCacheByHashMap.put(`hash:${hash}`, timestamp);
          }
        }
      } catch (error) {
        console.log(error);
        return;
      }
      lineIx++;
    }
  };
  await fn();
  await timestampCacheByHashMap.dbClose();
  await timestampCacheByHashMap.dbOpen();

  console.log('timestampCacheByHashMap.minKey', await timestampCacheByHashMap.hasget('minKey'));
  console.log('timestampCacheByHashMap.maxKey', await timestampCacheByHashMap.hasget('maxKey'));
  console.log('timestampCacheByHashMap.size', formatBytes(await timestampCacheByHashMap.size()));
  console.log('zeroTimestampHashSet.size', zeroTimestampHashSet.size);

  let stillZeroCount = 0;

  let progress = 0;
  for (const hash of zeroTimestampHashSet) {
    if (((progress % 10000) == 0) || (VERBOSE)) {
      console.log('progress', progress, 'of', timestampLines.length);
    }
    progress++;
    if (VERBOSE) {
      console.log('hash', hash);
    }
    const blockInfoReq = {
      action: 'blocks_info',
      json_block: true,
      hashes: [hash],
    };
    const blockInfoResp = await httpsRateLimit.sendRequest(blockInfoReq);
    const blockInfo = blockInfoResp.blocks[hash];
    zeroTimestampAccountSet.add(blockInfo.block_account);

    const boundingHashes = [];
    let newTimestampMin;
    let newTimestampMax;

    const getMinMaxTimestamp = () => {
      let newTimestampSum = BigInt(0);
      let newTimestampCount = BigInt(0);
      if (newTimestampMin != undefined) {
        newTimestampSum += newTimestampMin;
        newTimestampCount++;
      }
      if (newTimestampMax != undefined) {
        newTimestampSum += newTimestampMax;
        newTimestampCount++;
      }
      if (newTimestampCount == BigInt(0)) {
        return '0';
      } else {
        const newTimestamp = newTimestampSum / newTimestampCount;
        return newTimestamp.toString();
      }
    };

    const setMinMaxTimestamp = (timestamp) => {
      if (newTimestampMin == undefined) {
        newTimestampMin = timestamp;
      } else {
        if (newTimestampMin > timestamp) {
          newTimestampMin = timestamp;
        }
      }
      if (newTimestampMax == undefined) {
        newTimestampMax = timestamp;
      } else {
        if (newTimestampMax < timestamp) {
          newTimestampMax = timestamp;
        }
      }
    };

    const addIfNonZero = async (hash) => {
      if (hash !== ZEROS) {
        let addHash = true;
        if (await timestampCacheByHashMap.has(hash)) {
          const timestamp = BigInt(await timestampCacheByHashMap.get(hash));
          if (timestamp > BigInt(0)) {
            setMinMaxTimestamp(timestamp);
            addHash = false;
          }
        }
        if (addHash) {
          boundingHashes.push(hash);
        }
      }
    };

    let successor = ZEROS;
    let previous = ZEROS;
    let link = ZEROS;
    let source = ZEROS;
    if (blockInfo.subtype == 'receive') {
      link = blockInfo.contents.link;
    }
    if (blockInfo.contents.source != undefined) {
      source = blockInfo.contents.source;
    }
    if (blockInfo.successor !== undefined) {
      successor = blockInfo.successor;
    }
    if (blockInfo.contents.previous !== undefined) {
      previous = blockInfo.contents.previous;
    }
    if (VERBOSE) {
      // console.log('blockInfo', blockInfo);
      console.log('blockInfo.subtype', blockInfo.subtype);
      console.log('blockInfo.contents.type', blockInfo.contents.type);
      console.log('source', source);
      console.log('successor', successor);
      console.log('previous', previous);
    }
    await addIfNonZero(previous);
    await addIfNonZero(successor);
    await addIfNonZero(link);
    await addIfNonZero(source);
    // if (VERBOSE) {
    // console.log('boundingHashes', boundingHashes);
    // }
    const boundsBlockInfoReq = {
      action: 'blocks_info',
      json_block: true,
      hashes: boundingHashes,
    };
    const boundsBlockInfoResp = await httpsRateLimit.sendRequest(boundsBlockInfoReq);
    // console.log('boundsBlockInfoResp', boundsBlockInfoResp);
    // const newTimestampDebugLines = '';
    for (const boundingHash of boundingHashes) {
      const boundingBlockInfo = boundsBlockInfoResp.blocks[boundingHash];
      if (boundingBlockInfo !== undefined) {
        zeroTimestampAccountSet.add(boundingBlockInfo.block_account);
        const newTimestamp = BigInt(boundingBlockInfo.local_timestamp);
        // if (VERBOSE) {
        // }
        if (newTimestamp != BigInt(0)) {
          // console.log('boundingHash', boundingHash, 'newTimestamp', newTimestamp, 'date',
          // new Date(parseInt(boundingBlockInfo.local_timestamp, 10)*1000).toISOString());

          setMinMaxTimestamp(newTimestamp);
          // newTimestampSum += newTimestamp;
          // newTimestampCount++;
        } else {
          const boundingTimestampLine = `${boundingHash},${newTimestamp.toString()}`;
          appendLine(boundingTimestampLine);
        }
      }
    }

    const timestamp = getMinMaxTimestamp();
    if (timestamp == '0') {
      stillZeroCount++;
    }

    const newTimestampLine = `${hash},${timestamp}`;
    if (VERBOSE) {
      console.log('newTimestampLine', newTimestampLine);
    }

    if (timestamp == '0') {
      // console.log('newTimestampLine', newTimestampLine);
      appendLine(newTimestampLine);
    } else {
      await timestampCacheByHashMap.set(hash, timestamp);
    }
  }
  await timestampCacheByHashMap.dbClose();

  console.log('count of hashes with zero timestamp', stillZeroCount);
  console.log('count of accounts with zero timestamp block', zeroTimestampAccountSet.size);
};

const runOrError = async () => {
  try {
    await run();
  } catch (error) {
    console.trace(error);
  }
};

runOrError();
