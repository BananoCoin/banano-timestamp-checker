## to update outdated deps

    npm install package@latest;

## to publish a new version

    npm run preflight;

## commit here

    npm version patch;
    git pull;
    git push;
    git push --tags;
    npm publish --access public;
    
### update version in package-lock.json and run unit tests.
