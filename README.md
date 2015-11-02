# node-runtastic
A simple NodeJS-Module to fetch activities from [runtastic](https://www.runtastic.com)

## Usage
    var nodeRuntastic = require('node-runtastic');

    nodeRuntastic.setup('test@example.com', 'superSecret1!11').then(function (metaInfos) {
        console.log(metaInfos);
        nodeRuntastic.getActivities(10, 2015).then(function (activities) {
            console.log(activities);
        })
    });
