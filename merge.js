'use strict';
const fs = require('fs');
const readline = require('readline');

const DEBUG = false;

const getDate = (ts) => {
  // console.log('getDate', ts);
  return new Date(parseInt(ts, 10)*1000).toISOString().substring(0, 10);
};

const run = async () => {
  console.log('banano-timestamp-checker');

  if (process.argv.length < 5) {
    console.log('#usage:');
    console.log('npm run merge <merge-date> <before-file> <at-and-after-file> <outfile>');
    return;
  }

  const mergeDate = process.argv[2];
  const beforeFileName = process.argv[3];
  const atAndAfterFileName = process.argv[4];
  const outFileName = process.argv[5];

  console.log(`mergeDate:'${mergeDate}'`);
  console.log(`beforeFileName:'${beforeFileName}'`);
  console.log(`atAndAfterFileName:'${atAndAfterFileName}'`);
  console.log(`outFileName:'${outFileName}'`);

  const outStream = fs.createWriteStream(outFileName);

  const beforeFn = (timestamp) => {
    const date = getDate(timestamp);
    const flag = date.localeCompare(mergeDate) < 0;
    // console.log('beforeFn', timestamp, date, '<', mergeDate, '=', flag);
    return flag;
  };

  const atAndAfterFn = (timestamp) => {
    const date = getDate(timestamp);
    const flag = date.localeCompare(mergeDate) >= 0;
    // console.log('atAndAfterFn', timestamp, date, '>=', mergeDate, '=', flag);
    return flag;
  };

  const processStream = async (fileNm, timestampFn) => {
    let time = 0;
    let lineIx = 0n;
    let skippedLineCount = 0n;
    let writtenLineCount = 0n;
    let logCount = 0;
    const stream = fs.createReadStream(fileNm);
    const lines = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    for await (const line of lines) {
      // console.log('timestampLine', lineIx);
      try {
        if (Date.now() > time + 10000) {
          logCount++;
          console.log(fileNm, new Date(Date.now()).toISOString(), lineIx, 'skipped', skippedLineCount, 'written', writtenLineCount);
          time = Date.now();
        }
        if (DEBUG) {
          if (logCount > 2) {
            return;
          }
        }
        if (line.length !== 0) {
          const timestampData = line.split(',');
          const hash = timestampData[0];
          const timestamp = timestampData[1];
          if (timestampFn(timestamp)) {
            outStream.write(hash);
            outStream.write(',');
            outStream.write(timestamp);
            outStream.write('\n');
            writtenLineCount++;
          } else {
            skippedLineCount++;
          }
        }
      } catch (error) {
        console.log(error);
        return;
      }
      lineIx++;
    }
  };
  await processStream(beforeFileName, beforeFn);
  await processStream(atAndAfterFileName, atAndAfterFn);

  outStream.end();
};

const runOrError = async () => {
  try {
    await run();
  } catch (error) {
    console.trace(error);
  }
};

runOrError();
