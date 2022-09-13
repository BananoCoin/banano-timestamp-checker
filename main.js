'use strict';
const fs = require('fs');
const path = require('path');

const httpsRateLimit = require('https-rate-limit');

const DEBUG = false;
const VERBOSE = false;

const ZEROS = '0000000000000000000000000000000000000000000000000000000000000000';

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

  const timestampsStr = fs.readFileSync(timestampFileName, {encoding: 'UTF-8'});
  const timestampLines = timestampsStr.split('\n');

  if (DEBUG) {
    timestampLines.length = 10;
  }

  const timestampCacheByHashMap = {};
  timestampCacheByHashMap.set = (hash, timestamp) => {
    if (!fs.existsSync('data')) {
      fs.mkdirSync('data', {recursive: true});
    }
    const fileNm = path.join('data', hash);
    const filePtr = fs.openSync(fileNm, 'w');
    fs.writeSync(filePtr, timestamp);
    fs.closeSync(filePtr);
  };
  timestampCacheByHashMap.size = () => {
    if (fs.existsSync('data')) {
      return fs.readdirSync('data').length;
    }
    return 0;
  };
  timestampCacheByHashMap.has = (hash) => {
    const fileNm = path.join('data', hash);
    return fs.existsSync(fileNm);
  };
  timestampCacheByHashMap.get = (hash) => {
    const fileNm = path.join('data', hash);
    if (fs.existsSync(fileNm)) {
      return fs.readFileSync(fileNm, {encoding: 'UTF-8'});
    }
  };

  const zeroTimestampHashSet = new Set();

  // if (VERBOSE) {
  console.log('timestampLines.length', timestampLines.length);
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

  for (const timestampLine of timestampLines) {
    if (timestampLine.length !== 0) {
      const timestampData = timestampLine.split(',');
      const hash = timestampData[0];
      const timestamp = timestampData[1];
      if (BigInt(timestamp) == BigInt(0)) {
        zeroTimestampHashSet.add(hash);
      } else {
        timestampCacheByHashMap.set(hash, timestamp);
        const newTimestampLine = `${hash},${timestamp},o${new Date(timestamp*1000).toISOString()}`;
        if (VERBOSE) {
          console.log('newTimestampLine', newTimestampLine);
        }

        appendLine(newTimestampLine);
      }
    }
  }
  console.log('timestampCacheByHashMap.size', timestampCacheByHashMap.size());
  console.log('zeroTimestampHashSet.size', zeroTimestampHashSet.size);

  let stillZeroCount = 0;

  let progress = 0;
  for (const hash of zeroTimestampHashSet) {
    if ((progress % 10000) == 0) {
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

    const addIfNonZero = (hash) => {
      if (hash !== ZEROS) {
        let addHash = true;
        if (timestampCacheByHashMap.has(hash)) {
          const timestamp = BigInt(timestampCacheByHashMap.get(hash));
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
    if (blockInfo.subtype == 'receive') {
      link = blockInfo.contents.link;
    }
    if (blockInfo.successor !== undefined) {
      successor = blockInfo.successor;
    }
    if (blockInfo.contents.previous !== undefined) {
      previous = blockInfo.contents.previous;
    }
    if (VERBOSE) {
      console.log('blockInfo.subtype', blockInfo.subtype);
      console.log('successor', successor);
      console.log('previous', previous);
    }
    addIfNonZero(previous);
    addIfNonZero(successor);
    addIfNonZero(link);
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
    let newTimestampDebugLines = '';
    for (const boundingHash of boundingHashes) {
      const boundingBlockInfo = boundsBlockInfoResp.blocks[boundingHash];
      if (boundingBlockInfo !== undefined) {
        const newTimestamp = BigInt(boundingBlockInfo.local_timestamp);
        // if (VERBOSE) {
        // }
        if (newTimestamp != BigInt(0)) {
          // console.log('boundingHash', boundingHash, 'newTimestamp', newTimestamp, 'date',
          // new Date(parseInt(boundingBlockInfo.local_timestamp, 10)*1000).toISOString());

          setMinMaxTimestamp(newTimestamp);
          // newTimestampSum += newTimestamp;
          // newTimestampCount++;
        }

        const newTimestampDebugLine = `${boundingHash},${boundingBlockInfo.local_timestamp},d${new Date(parseInt(boundingBlockInfo.local_timestamp, 10)*1000).toISOString()}\n`;

        if (VERBOSE) {
          console.log('newTimestampDebugLine', newTimestampDebugLine);
        }

        newTimestampDebugLines += newTimestampDebugLine;
      }
    }

    const timestamp = getMinMaxTimestamp();
    // if (VERBOSE) {
    // console.log('newTimestampCount', newTimestampCount, 'newTimestampSum', newTimestampSum, 'timestamp', timestamp, 'date', new Date(timestamp*1000).toISOString());
    // }

    if (timestamp == '0') {
      stillZeroCount++;
      appendLine(newTimestampDebugLines);
    }

    const newTimestampLine = `${hash},${timestamp},n${new Date(timestamp*1000).toISOString()}`;
    if (VERBOSE) {
      console.log('newTimestampLine', newTimestampLine);
    }

    appendLine(newTimestampLine);
  }

  console.log('count of hashes with zero timestamp', stillZeroCount);
};

const runOrError = async () => {
  try {
    await run();
  } catch (error) {
    console.trace(error);
  }
};

runOrError();
