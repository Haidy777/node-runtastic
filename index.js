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
        var context = this;
        return new Pact(function (resolve, reject) {
            if (username !== '' && password !== '') {
                context._username = username;
                context._password = password;
                context._login().then(function (metaInfo) {
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
        var context = this;
        return new Pact(function (resolve, reject) {
            if (context._username !== '' && context._password !== '') {
                context._cookieJar = request.jar();
                request({
                    method: 'POST',
                    uri: context._baseUrl + context._loginUrl,
                    form: {
                        'user[email]': context._username,
                        'user[password]': context._password
                    },
                    jar: context._cookieJar
                }, function (error, response, body) {
                    if (error) {
                        console.log(error);
                        reject();
                    }

                    if (response && response.statusCode === 200) {
                        body = JSON.parse(body);
                        var currentUser = body.current_user;

                        context._metaInfo.id = currentUser.id;
                        context._metaInfo.username = currentUser.slug;
                        context._metaInfo.firstName = currentUser.first_name;
                        context._metaInfo.lastName = currentUser.last_name;
                        context._metaInfo.height = currentUser.height;
                        context._metaInfo.weight = currentUser.weight;

                        var loadedDOM = cheerio.load(body.update);

                        context._authenticityToken = loadedDOM('input[name=authenticity_token]').val();
                        context.loggedIn = true;
                        resolve(context._metaInfo);
                    }
                });
            }
        });
    },

    _getAllActivities: function () {
        var context = this;

        return new Pact(function (resolve, reject) {
            if (!context.loggedIn) {
                context.login().then(function (metaInfo) {
                    console.log(metaInfo);
                    context.getAllActivities();
                });
            } else {
                request({
                    method: 'GET',
                    uri: context._baseUrl + '/en/users/' + context._metaInfo.username + '/sport-sessions',
                    jar: context._cookieJar
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
        var context = this;

        if (month && month < 10) {
            month = '0' + month.toString();
        }

        if (year && year < 1000) {
            return 'Year should be bigger than 1000';
        }

        return new Pact(function (resolve, reject) {
            if (context.loggedIn) {
                context._getAllActivities().then(function (activities) {
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
                        uri: context._baseUrl + context._sessionsApiUrl,
                        form: {
                            'user_id': context._metaInfo.id,
                            'items': filteredActivities.join(','),
                            'authenticity_token': context._authenticityToken
                        },
                        jar: context._cookieJar
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
        var context = this;
        return new Pact(function (resolve, reject) {
            context.getActivities(month, year).each(function (activity) {
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