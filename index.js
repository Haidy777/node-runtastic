var request = require('request');
var cheerio = require('cheerio');
var Pact = require('bluebird');
var _ = require('underscore');
var moment = require('moment');

var nodeRuntastic = {
    _username: '',

    _password: '',

    _baseUrl: 'https://www.runtastic.com',

    _loginUrl: '/en/d/users/sign_in.json',

    _logoutUrl: '/en/d/users/sign_out',

    _sessionsApiUrl: '/api/run_sessions/json',

    _authenticityToken: '',

    _cookieJar: null,

    loggedIn: false,

    _metaInfo: {
        id: null,
        username: '',
        firstName: '',
        lastName: '',
        height: null,
        weight: null
    },

    setup: function (username, password) {
        var self = this;
        return new Pact(function (resolve, reject) {
            if (username !== '' && password !== '') {
                self._username = username;
                self._password = password;
                self._login().then(function (metaInfo) {
                    resolve(metaInfo);
                });
            } else {
                reject('No username or password supplied.')
            }
        });
    },

    getMetaInfos: function () {
        if (this.loggedIn) {
            return this._metaInfo;
        } else {
            return 'Not logged in, run setup Method.';
        }
    },

    _login: function () {
        var self = this;
        return new Pact(function (resolve, reject) {
            if (self._username !== '' && self._password !== '') {
                self._cookieJar = request.jar();
                request({
                    method: 'POST',
                    uri: self._baseUrl + self._loginUrl,
                    form: {
                        'user[email]': self._username,
                        'user[password]': self._password
                    },
                    jar: self._cookieJar
                }, function (error, response, body) {
                    if (error) {
                        console.log(error);
                        reject();
                    }

                    if (response && response.statusCode === 200) {
                        body = JSON.parse(body);
                        var currentUser = body.current_user;

                        self._metaInfo.id = currentUser.id;
                        self._metaInfo.username = currentUser.slug;
                        self._metaInfo.firstName = currentUser.first_name;
                        self._metaInfo.lastName = currentUser.last_name;
                        self._metaInfo.height = currentUser.height;
                        self._metaInfo.weight = currentUser.weight;

                        var loadedDOM = cheerio.load(body.update);

                        self._authenticityToken = loadedDOM('input[name=authenticity_token]').val();
                        self.loggedIn = true;
                        resolve(self._metaInfo);
                    }
                });
            }
        });
    },

    _getAllActivities: function () {
        var self = this;

        return new Pact(function (resolve, reject) {
            if (!self.loggedIn) {
                self.login().then(function (metaInfo) {
                    console.log(metaInfo);
                    self.getAllActivities();
                });
            } else {
                request({
                    method: 'GET',
                    uri: self._baseUrl + '/en/users/' + self._metaInfo.username + '/sport-sessions',
                    jar: self._cookieJar
                }, function (error, response, body) {
                    if (error) {
                        console.log(error);
                        reject();
                    }

                    if (response && response.statusCode === 200) {
                        var loadedDOM = cheerio.load(body);
                        //search for all scriptTags
                        var scriptTags = loadedDOM('script');

                        //search for scriptTag with the designated data
                        var dataTag = _.filter(scriptTags, function (scriptTag) {
                            if (scriptTag.children[0]) {
                                return scriptTag.children[0].data.indexOf('index_data') !== -1;
                            }
                            return false;
                        })[0];

                        //remove unessesary things and parse as json, so we have arrays
                        var data = JSON.parse(dataTag.children[0].data.substr(73).split(';')[0]);

                        //sort data by date asc
                        data = _.sortBy(data, '1');

                        resolve(data);
                    } else {
                        reject();
                    }
                });
            }
        });
    },

    getActivities: function (month, year) {
        var self = this;

        if (month && month < 10) {
            month = '0' + month.toString();
        }

        if (year && year < 1000) {
            return 'Year should be bigger than 1000';
        }

        return new Pact(function (resolve, reject) {
            if (self.loggedIn) {
                self._getAllActivities().then(function (activities) {
                    var filteredActivities = _.filter(activities, function (activity) {
                        var activityDate = moment(activity[1]).format('YYYY-MM');

                        if (month && year) { //Use month and year to find entries
                            return activityDate == year.toString() + '-' + month.toString();
                        } else if (month) { //Use month in current year to find entries
                            return activityDate == moment().format('YYYY') + '-' + month.toString();
                        } else if (year) { //Use current year to find entries
                            return activityDate.substr(0, 4) == year;
                        }
                    });

                    request({
                        method: 'POST',
                        uri: self._baseUrl + self._sessionsApiUrl,
                        form: {
                            'user_id': self._metaInfo.id,
                            'items': filteredActivities.join(','),
                            'authenticity_token': self._authenticityToken
                        },
                        jar: self._cookieJar
                    }, function (error, response, body) {
                        if (error) {
                            console.log(error);
                            reject();
                        }

                        if (response && response.statusCode === 200) {
                            resolve(JSON.parse(body));
                        } else {
                            reject();
                        }
                    });
                });
            } else {
                reject('Not logged in, run setup Method.');
            }
        });
    },

    getActivitiesWithFormatedDate: function (month, year) {
        var self = this;
        return new Pact(function (resolve, reject) {
            self.getActivities(month, year).each(function (activity) {
                var activityDate = activity.date;
                activity.date =
                    activityDate.year + '-'
                    + activityDate.month + '-'
                    + activityDate.day + ' '
                    + (activityDate.hour < 10 ? '0' + activityDate.hour : activityDate.hour) + ':'
                    + (activityDate.minutes < 10 ? '0' + activityDate.minutes : activityDate.minutes) + ':'
                    + (activityDate.seconds < 10 ? '0' + activityDate.seconds : activityDate.seconds);
            }).then(function (activities) {
                resolve(_.sortBy(activities, 'date'));
            }).catch(function (e) {
                reject(e);
            });
        });
    }
};

module.exports = nodeRuntastic;