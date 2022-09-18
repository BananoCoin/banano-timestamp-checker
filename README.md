# banano-timestamp-checker

checks timestamps, and updates them if they are zero.

note that this process is long and involved several steps.

1. export all zero timestamps using the command:

        ./bananode --timestamps_export --file timestamps_out.csv --start_timestamp 0 --end_timestamp 0;

2. run a command that finds a block timestamp for as many zero timestamps as it can.

        npm start timestamps_out.csv timestamps_cantfix.csv https://127.0.0.1/7072;

    It checks previous, successor, and link on the block info.
    If all three of these are zero, it outputs the zero to timestamps_cantfix.csv

    For blocks it can fix, it puts the new timestamp in the ./data/ directory.

3. rerun the command to fix more timestamps.

       npm start timestamps_out.csv timestamps_cantfix.csv https://127.0.0.1/7072;

    eventually you will get dimishing returns, as some times there are very long chains of zero timestamps.

4. merge the timestamps back into one file, by running 'merge' on the file you exported from the node.

       npm run merge timestamps_out.csv timestamps_new.csv

5. reimport the timestamps to the bananode

       ./bananode --timestamps_import --file timestamps_new.csv
