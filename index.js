var request = require('request');
var jsdom = require('jsdom');
var Promise = require('bluebird');
var _ = require('underscore');

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

    metaInfo: {
        id: null,
        username: '',
        firstName: '',
        lastName: '',
        height: null,
        weight: null
    },

    login: function () {
        var self = this;
        return new Promise(function (resolve, reject) {
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

                        self.metaInfo.id = currentUser.id;
                        self.metaInfo.username = currentUser.slug;
                        self.metaInfo.firstName = currentUser.first_name;
                        self.metaInfo.lastName = currentUser.last_name;
                        self.metaInfo.height = currentUser.height;
                        self.metaInfo.weight = currentUser.weight;

                        jsdom.env(body.update, function (error, window) {
                            if (error) {
                                console.log(error);
                                reject();
                            }
                            self._authenticityToken = window.document.getElementsByName('authenticity_token')[0].value;
                            self.loggedIn = true;
                            resolve(self.metaInfo);
                        });
                    }
                });
            }
        });
    },

    getAllActivities: function () {
        var self = this;

        return new Promise(function (resolve, reject) {
            if (!self.loggedIn) {
                self.login().then(function (metaInfo) {
                    console.log(metaInfo);
                    self.getAllActivities();
                });
            } else {
                request({
                    method: 'GET',
                    uri: self._baseUrl + '/en/users/' + self.metaInfo.username + '/sport-sessions',
                    jar: self._cookieJar
                }, function (error, response, body) {
                    if (error) {
                        console.log(error);
                        reject();
                    }

                    if (response && response.statusCode === 200) {
                        jsdom.env(body, function (error, window) {
                            if (error) {
                                console.log(error);
                                reject();
                            }

                            //search for all scriptTags
                            var scriptTags = window.document.getElementsByTagName('script');

                            //search for scriptTag with the designated data
                            var dataTag = _.filter(scriptTags, function (scriptTag) {
                                return scriptTag.innerHTML.indexOf('index_data') > -1;
                            })[0];

                            //remove unessesary things and parse as json, so we have arrays
                            var data = JSON.parse(dataTag.innerHTML.substr(73).split(';')[0]);

                            //sort data by date asc
                            data = _.sortBy(data, '1');

                            resolve(data);
                        });
                    }
                });
            }
        });
    }
};

module.exports = nodeRuntastic;