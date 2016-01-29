# node-runtastic
A simple NodeJS-Module to fetch activities from [runtastic](https://www.runtastic.com)

Based on [timoschlueter/php-runtastic](https://github.com/timoschlueter/php-runtastic)

## Usage
    var nodeRuntastic = require('node-runtastic');

    nodeRuntastic.setup('test@example.com', 'superSecret1!11').then(function (metaInfos) {
        console.log(metaInfos);
        nodeRuntastic.getActivities(10, 2015).then(function (activities) {
            console.log(activities);
        })
    });
## Functions
### setup
- argument 1 needs to be username
- argument 2 needs to be password
- returns metaInfos of user

### getActivities
- argument 1 can be month
- argument 2 can be year
- returns all activities (if no argument is used) or filtered activities by month / year you supplied

### getActivitiesWithFormatedDate
- needs and does the same as 'getActivities' but
- returns activities with a better formated date

### getMetaInfos
- gets you the same metaInfos as setup
