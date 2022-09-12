'use strict';
const fs = require('fs');

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

  const timestampCacheByHashMap = new Map();

  const zeroTimestampHashSet = new Set();

  // if (VERBOSE) {
  console.log('timestampLines.length', timestampLines.length);
  // }

  for (const timestampLine of timestampLines) {
    if (timestampLine.length !== 0) {
      const timestampData = timestampLine.split(',');
      const hash = timestampData[0];
      const timestamp = timestampData[1];
      if (BigInt(timestamp) == BigInt(0)) {
        zeroTimestampHashSet.add(hash);
      } else {
        timestampCacheByHashMap.set(hash, timestamp);
      }
    }
  }
  console.log('timestampCacheByHashMap.size', timestampCacheByHashMap.size);
  console.log('zeroTimestampHashSet.size', zeroTimestampHashSet.size);

  let stillZeroCount = 0;
  let newTimestampLines = '';
  for (const [hash, timestamp] of timestampCacheByHashMap) {
    const newTimestampLine = `${hash},${timestamp}`;
    if (VERBOSE) {
      console.log('newTimestampLine', newTimestampLine);
    }

    newTimestampLines += newTimestampLine;
    newTimestampLines += '\n';
  }

  let progress = 0;
  for (const hash of zeroTimestampHashSet) {
    if ((progress % 10000) == 0) {
      console.log('progress', progress, 'of', timestampLines.length);
    }
    progress++;
    let timestamp = 0;
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
    let newTimestampSum = BigInt(0);
    let newTimestampCount = BigInt(0);

    const addIfNonZero = (hash) => {
      if (hash !== ZEROS) {
        let addHash = true;
        if (timestampCacheByHashMap.has(hash)) {
          const timestamp = BigInt(timestampCacheByHashMap.get(hash));
          if (timestamp > BigInt(0)) {
            newTimestampSum += timestamp;
            newTimestampCount++;
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
        newTimestampSum += BigInt(boundingBlockInfo.local_timestamp);
        newTimestampCount++;

        const newTimestampDebugLine = `${boundingHash},${boundingBlockInfo.local_timestamp}\n`;

        if (VERBOSE) {
          console.log('newTimestampDebugLine', newTimestampDebugLine);
        }

        newTimestampDebugLines += newTimestampDebugLine;
      }
    }
    timestamp = newTimestampSum / newTimestampCount;
    timestamp = timestamp.toString();

    if (timestamp == '0') {
      stillZeroCount++;
      newTimestampLines += newTimestampDebugLines;
    }

    const newTimestampLine = `${hash},${timestamp}`;
    if (VERBOSE) {
      console.log('newTimestampLine', newTimestampLine);
    }

    newTimestampLines += newTimestampLine;
    newTimestampLines += '\n';
  }

  console.log('count of hashes with zero timestamp', stillZeroCount);

  const outFilePtr = fs.openSync(outFileNm, 'w');
  fs.writeSync(outFilePtr, newTimestampLines);
  fs.closeSync(outFilePtr);
};

const runOrError = async () => {
  try {
    await run();
  } catch (error) {
    console.trace(error);
  }
};

runOrError();
