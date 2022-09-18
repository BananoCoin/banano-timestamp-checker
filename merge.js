'use strict';
const fs = require('fs');
const path = require('path');

const VERBOSE = true;

const getDate = (ts) => {
  const tsInt = parseInt(ts, 10)*1000;
  return new Date(tsInt).toISOString();
};

const run = async () => {
  console.log('banano-distribution-stats merge');
  if (process.argv.length < 3) {
    console.log('#usage:');
    console.log('npm run merge <timestamp-in-file> <timestamp-out-file>');
  } else {
    const timestampInFileNm = process.argv[2];
    const timestampOutFileNm = process.argv[3];
    console.log('timestampInFileNm', timestampInFileNm);
    console.log('timestampOutFileNm', timestampOutFileNm);


    const clearLines = () => {
      const outFilePtr = fs.openSync(timestampOutFileNm, 'w');
      fs.closeSync(outFilePtr);
    };

    const appendLine = (line) => {
      const outFilePtr = fs.openSync(timestampOutFileNm, 'a');
      fs.writeSync(outFilePtr, line);
      fs.writeSync(outFilePtr, '\n');
      fs.closeSync(outFilePtr);
    };

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

    clearLines();

    const timestampsStr = fs.readFileSync(timestampInFileNm, {encoding: 'UTF-8'});
    const timestampLines = timestampsStr.split('\n');
    for (const timestampLine of timestampLines) {
      if (timestampLine.length !== 0) {
        const timestampData = timestampLine.split(',');
        const hash = timestampData[0];
        const oldTimestamp = timestampData[1];
        if (timestampCacheByHashMap.has(hash)) {
          const newTimestamp = BigInt(timestampCacheByHashMap.get(hash));
          if (VERBOSE) {
            console.log(hash, oldTimestamp, '=>', newTimestamp, getDate(newTimestamp));
          }
          const newTimestampLine = `${hash},${newTimestamp.toString()}`;
          appendLine(newTimestampLine);
        }
      }
    }
  }
};

const runOrError = async () => {
  try {
    await run();
  } catch (error) {
    console.trace(error);
  }
};

runOrError();
