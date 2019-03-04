/* global angular */
'use strict';

/**
 * Main App Module
 */
function add(a, b) {
    return a + b;
}

//noinspection JSUnusedLocalSymbols
var app = angular.module('app', ['utils', 'search', 'socket-io', 'ngAnimate', 'ui.bootstrap'])
    .factory('mySocket', function (socketFactory) {
        var mySocket = socketFactory({namespace: '/status'});
        mySocket.forward('DispatcherHeartbeat');
        mySocket.forward('IngestHeartbeat');
        // mySocket.forward('HardDriveFailures');
        mySocket.forward('ServiceHeartbeat');
        // mySocket.forward('OrchestratorHeartbeat');
        mySocket.forward('monitoring');
        mySocket.setConnectionCallback(function () {
            mySocket.emit("monitor", {'status': "start"});
        });
        return mySocket;
    })
    .controller('ALController', function ($scope, $http, $timeout, mySocket) {
        $scope.user = null;
        $scope.socket_status = 'init';
        $scope.data = {
            orchestrator: {
                cores: {
                    total: 0.0000001,
                    used: 0
                },
                memory: {
                    total: 0.0000001,
                    used: 0
                },
                node_count: 0,
                registered_node_count: 0
            },
            dispatchers_stat: {
                services: {
                    up: [],
                    down: [],
                    not_provisioned: []
                },
                outstanding: 0,
                queues: {
                    ingest: 0,
                    response: 0,
                    control: 0,
                    max_inflight: 0
                },
                errors: [],
                count: 0
            },
            ingester: {
                ingest: 0,
                inflight: 0,
                'ingest.bytes_completed': 0,
                'ingest.bytes_ingested': 0,
                'ingest.duplicates': 0,
                'ingest.files_completed': 0,
                'ingest.skipped': 0,
                'ingest.submissions_completed': 0,
                'ingest.submissions_ingested': 0,
                'ingest.timed_out': 0,
                'ingest.whitelisted': 0,
                ingesting: {
                    critical: 1,
                    high: 1,
                    medium: 1,
                    low: 1
                },
                queues: {
                    critical: 0,
                    high: 0,
                    medium: 0,
                    low: 0
                },
                shard: 0,
                up_hours: 0,
                waiting: 0
            },
            ingester_stat: {
                count: 0,
                index: 1,
                'inflight': [0],
                'ingest': [0],
                'ingesting.critical': [0],
                'ingesting.high': [0],
                'ingesting.low': [0],
                'ingesting.medium': [0],
                'queues.critical': [0],
                'queues.high': [0],
                'queues.low': [0],
                'queues.medium': [0],
                'up_hours': [0],
                'waiting': [0],
                'ingest.submissions_completed': [0],
                'ingest.bytes_completed': [0],
                'ingest.bytes_ingested': [0],
                'ingest.skipped': [0],
                'ingest.files_completed': [0],
                'ingest.whitelisted': [0],
                'ingest.duplicates': [0]
            }
        };
        $scope.service_running = {};
        $scope.disp_msg_count = 0;
        $scope.service_expiry = {};
        $scope.bad_disks = [];
        $scope.expiry_late = [];

        //DEBUG MODE
        $scope.debug = false;
        $scope.showParams = function () {
            console.log("Scope", $scope)
        };

        $scope.$on('socket:IngestHeartbeat', function (event, data) {
            try {
                console.log('Socket-IO::IngestHeartbeat message', data);
                var index_jump = 1;
                var cur_time = Math.floor(new Date().getTime() / 1000);
                if ($scope.last_mm_hb !== undefined) {
                    index_jump = cur_time - $scope.last_mm_hb;
                }

                if (index_jump > 0) {
                    $scope.data.ingester_stat.index += index_jump;
                    for (var x = index_jump - 1; x > 0; x--) {
                        $scope.data.ingester_stat['ingest.submissions_completed'][($scope.data.ingester_stat.index - x) % 60] = 0;
                        $scope.data.ingester_stat['ingest.bytes_completed'][($scope.data.ingester_stat.index - x) % 60] = 0;
                        $scope.data.ingester_stat['ingest.bytes_ingested'][($scope.data.ingester_stat.index - x) % 60] = 0;
                        $scope.data.ingester_stat['ingest.files_completed'][($scope.data.ingester_stat.index - x) % 60] = 0;
                        $scope.data.ingester_stat['ingest.skipped'][($scope.data.ingester_stat.index - x) % 60] = 0;
                        $scope.data.ingester_stat['ingest.whitelisted'][($scope.data.ingester_stat.index - x) % 60] = 0;
                        $scope.data.ingester_stat['ingest.duplicates'][($scope.data.ingester_stat.index - x) % 60] = 0;
                    }

                    $scope.data.ingester_stat['ingest.submissions_completed'][$scope.data.ingester_stat.index % 60] = data.body['ingest.submissions_completed'];
                    $scope.data.ingester_stat['ingest.bytes_completed'][$scope.data.ingester_stat.index % 60] = data.body['ingest.bytes_completed'];
                    $scope.data.ingester_stat['ingest.bytes_ingested'][$scope.data.ingester_stat.index % 60] = data.body['ingest.bytes_ingested'];
                    $scope.data.ingester_stat['ingest.files_completed'][$scope.data.ingester_stat.index % 60] = data.body['ingest.files_completed'];
                    $scope.data.ingester_stat['ingest.skipped'][$scope.data.ingester_stat.index % 60] = data.body['ingest.skipped'];
                    $scope.data.ingester_stat['ingest.whitelisted'][$scope.data.ingester_stat.index % 60] = data.body['ingest.whitelisted'];
                    $scope.data.ingester_stat['ingest.duplicates'][$scope.data.ingester_stat.index % 60] = data.body['ingest.duplicates'];
                } else {
                    $scope.data.ingester_stat['ingest.submissions_completed'][$scope.data.ingester_stat.index % 60] += data.body['ingest.submissions_completed'];
                    $scope.data.ingester_stat['ingest.bytes_completed'][$scope.data.ingester_stat.index % 60] += data.body['ingest.bytes_completed'];
                    $scope.data.ingester_stat['ingest.bytes_ingested'][$scope.data.ingester_stat.index % 60] += data.body['ingest.bytes_ingested'];
                    $scope.data.ingester_stat['ingest.files_completed'][$scope.data.ingester_stat.index % 60] += data.body['ingest.files_completed'];
                    $scope.data.ingester_stat['ingest.skipped'][$scope.data.ingester_stat.index % 60] += data.body['ingest.skipped'];
                    $scope.data.ingester_stat['ingest.whitelisted'][$scope.data.ingester_stat.index % 60] += data.body['ingest.whitelisted'];
                    $scope.data.ingester_stat['ingest.duplicates'][$scope.data.ingester_stat.index % 60] += data.body['ingest.duplicates'];
                }

                var shard = data.body['shard'];
                $scope.data.ingester_stat['inflight'][shard] = data.body['inflight'];
                $scope.data.ingester_stat['ingest'][shard] = data.body['ingest'];
                $scope.data.ingester_stat['ingesting.critical'][shard] = data.body['ingesting']['critical'];
                $scope.data.ingester_stat['ingesting.high'][shard] = data.body['ingesting']['high'];
                $scope.data.ingester_stat['ingesting.low'][shard] = data.body['ingesting']['low'];
                $scope.data.ingester_stat['ingesting.medium'][shard] = data.body['ingesting']['medium'];
                $scope.data.ingester_stat['queues.critical'][shard] = data.body['queues']['critical'];
                $scope.data.ingester_stat['queues.high'][shard] = data.body['queues']['high'];
                $scope.data.ingester_stat['queues.low'][shard] = data.body['queues']['low'];
                $scope.data.ingester_stat['queues.medium'][shard] = data.body['queues']['medium'];
                $scope.data.ingester_stat['up_hours'][shard] = data.body['up_hours'];
                $scope.data.ingester_stat['waiting'][shard] = data.body['waiting'];

                $scope.last_mm_hb = cur_time;

                if (shard != 0) {
                    return;
                }

                $scope.data.ingester_stat.count = $scope.data.ingester_stat['inflight'].length;
                data.body['inflight'] = $scope.data.ingester_stat['inflight'].reduce(add, 0);
                data.body['ingest'] = $scope.data.ingester_stat['ingest'].reduce(add, 0);
                data.body['ingesting']['critical'] = $scope.data.ingester_stat['ingesting.critical'].reduce(add, 0) / $scope.data.ingester_stat['ingesting.critical'].length;
                data.body['ingesting']['high'] = $scope.data.ingester_stat['ingesting.high'].reduce(add, 0) / $scope.data.ingester_stat['ingesting.high'].length;
                data.body['ingesting']['low'] = $scope.data.ingester_stat['ingesting.low'].reduce(add, 0) / $scope.data.ingester_stat['ingesting.low'].length;
                data.body['ingesting']['medium'] = $scope.data.ingester_stat['ingesting.medium'].reduce(add, 0) / $scope.data.ingester_stat['ingesting.medium'].length;
                data.body['queues']['critical'] = $scope.data.ingester_stat['queues.critical'].reduce(add, 0);
                data.body['queues']['high'] = $scope.data.ingester_stat['queues.high'].reduce(add, 0);
                data.body['queues']['low'] = $scope.data.ingester_stat['queues.low'].reduce(add, 0);
                data.body['queues']['medium'] = $scope.data.ingester_stat['queues.medium'].reduce(add, 0);
                data.body['up_hours'] = $scope.data.ingester_stat['up_hours'].reduce(add, 0) / $scope.data.ingester_stat['up_hours'].length;
                data.body['waiting'] = $scope.data.ingester_stat['waiting'].reduce(add, 0);

                data.body['ingest.submissions_completed'] = $scope.data.ingester_stat['ingest.submissions_completed'].reduce(add, 0);
                data.body['ingest.bytes_completed'] = $scope.data.ingester_stat['ingest.bytes_completed'].reduce(add, 0);
                data.body['ingest.bytes_ingested'] = $scope.data.ingester_stat['ingest.bytes_ingested'].reduce(add, 0);
                data.body['ingest.files_completed'] = $scope.data.ingester_stat['ingest.files_completed'].reduce(add, 0);
                data.body['ingest.skipped'] = $scope.data.ingester_stat['ingest.skipped'].reduce(add, 0);
                data.body['ingest.whitelisted'] = $scope.data.ingester_stat['ingest.whitelisted'].reduce(add, 0);
                data.body['ingest.duplicates'] = $scope.data.ingester_stat['ingest.duplicates'].reduce(add, 0);

                $scope.data.ingester = data.body;
            }
            catch (e) {
                console.log('Socket-IO::IngestHeartbeat [ERROR] Invalid message', data, e);
            }

        });

        /*
        $scope.$on('socket:HardDriveFailures', function (event, data) {
            if (data.sender === undefined) {
                return;
            }

            try {
                for (var key in $scope.bad_disks) {
                    var bd_temp = $scope.bad_disks[key];
                    if (bd_temp.ip == data.body.ip) {
                        $scope.bad_disks[key] = data.body;
                        return;
                    }
                }
                $scope.bad_disks.push(data.body);
            }
            catch (e) {
                console.log('Socket-IO::HardDriveFailures [ERROR] Invalid message', data, e);
            }

        });

        $scope.$on('socket:OrchestratorHeartbeat', function (event, data) {
            if (data.sender === undefined) {
                return;
            }

            try {
                $scope.data.orchestrator = data.body.resources;
                for (var svc_name in data.body.services){
                    var mult = 1;
                    if (data.body.vms.hasOwnProperty(svc_name)){
                        mult = data.body.vms[svc_name].num_workers;
                    }
                    var svc_details = data.body.services[svc_name];
                    $scope.data.services[svc_name]['workers'] = svc_details['nodes'].length * mult;
                }
                $scope.cpu_gauge.moveTo(Math.min($scope.data.orchestrator.cores.used/$scope.data.orchestrator.cores.total, 1));
                $scope.ram_gauge.moveTo(Math.min($scope.data.orchestrator.memory.used/$scope.data.orchestrator.memory.total, 1));
            }
            catch (e) {
                console.log('Socket-IO::HardDriveFailures [ERROR] Invalid message', data, e);
            }

        });
        */

        $scope.ingester_in_error = function (ingester) {
            try {
                if (ingester.ingesting.critical != 1) {
                    return true;
                }
                if (ingester.ingesting.high != 1) {
                    return true;
                }
                if (ingester.ingesting.medium != 1) {
                    return true;
                }
                if (ingester.ingesting.low != 1) {
                    return true;
                }
                if (ingester['ingest.bytes_completed'] == 0) {
                    return true;
                }
                if (ingester.ingest > 100000) {
                    return true;
                }
            } catch (e) {
                return true;
            }
            return false;
        };

        $scope.round = function (val) {
            return Math.round(val);
        };

        $scope.aggregate_dispatcher_stats = function () {
            var temp = {
                services: {
                    up: [],
                    down: [],
                    not_provisioned: []
                },
                outstanding: 0,
                queues: {
                    ingest: 0,
                    response: 0,
                    control: 0,
                    max_inflight: 0
                },
                errors: [],
                count: 0
            };

            for (var id in $scope.data.shards) {
                var dispatcher = $scope.data.shards[id];
                dispatcher.services.up.forEach(function (element) {
                    var s_name = element;
                    if (temp.services.up.indexOf(s_name) === -1) {
                        temp.services.up.push(s_name);
                    }
                });
                dispatcher.services.not_provisioned.forEach(function (element) {
                    var s_name = element;
                    var idx = temp.services.up.indexOf(s_name);
                    if (idx !== -1) {
                        temp.services.up.splice(idx, 1);
                    }
                    if (temp.services.not_provisioned.indexOf(s_name) === -1) {
                        temp.services.not_provisioned.push(s_name);
                    }
                });
                dispatcher.services.down.forEach(function (element) {
                    var s_name = element;
                    var idx = temp.services.up.indexOf(s_name);
                    if (idx !== -1) {
                        temp.services.up.splice(idx, 1);
                    }
                    idx = temp.services.not_provisioned.indexOf(s_name);
                    if (idx !== -1) {
                        temp.services.not_provisioned.splice(idx, 1);
                    }
                    if (temp.services.down.indexOf(s_name) === -1) {
                        temp.services.down.push(s_name);
                    }
                });
                temp.outstanding += dispatcher.entries;
                temp.queues.ingest += dispatcher.queues.ingest;
                temp.queues.response += dispatcher.queues.response;
                temp.queues.control += dispatcher.queues.control;
                temp.queues.max_inflight += dispatcher.queues.max_inflight;
                if ($scope.dispatcher_in_error(dispatcher)) {
                    temp.errors.push(dispatcher.id);
                }
                temp.count += 1;
            }
            $scope.data.dispatchers_stat = temp;
        };

        $scope.$on('socket:DispatcherHeartbeat', function (event, data) {
            try {
                console.log('Socket-IO::DispatcherHeartbeat message', data);
                $scope.data.shards[data.body.shard].entries = data.body.entries;
                $scope.data.shards[data.body.shard].queues = data.body.queues;
                $scope.data.shards[data.body.shard].services = {up: [], down: [], not_provisioned: []};
                $scope.data.shards[data.body.shard].enabled = true;

                for (var service in data.body.services) {
                    var item = data.body.services[service];

                    $scope.data.services[service]['enabled'] = true;
                    $scope.data.services[service].errors.not_reported = false;
                    if (item.is_up) {
                        $scope.data.shards[data.body.shard].services.up.push(service);
                        $scope.data.services[service].errors.marked_down = false;
                        $scope.data.services[service].errors.not_provisioned = false;
                    }
                    else {
                        if ($scope.data.services[service].workers !== 0) {
                            $scope.data.shards[data.body.shard].services.down.push(service);
                            $scope.data.services[service].errors.marked_down = true;
                            $scope.data.services[service].errors.not_provisioned = false;
                        }
                        else {
                            $scope.data.shards[data.body.shard].services.not_provisioned.push(service);
                            $scope.data.services[service].errors.not_provisioned = true;
                            $scope.data.services[service].errors.marked_down = false;
                        }
                    }
                }

                for (var service_name in $scope.data.services){
                    if (!data.body.services.hasOwnProperty(service_name)){
                        $scope.data.services[service_name]['enabled'] = false;
                    }
                }

                $scope.disp_msg_count += 1;
                if ($scope.disp_msg_count % $scope.dispatcher_shards_count === 0) $scope.aggregate_dispatcher_stats();
            }
            catch (e) {
                console.log('Socket-IO::DispatcherHeartbeat [ERROR] Invalid message', data, e);
            }

        });

        $scope.dispatcher_in_error = function (dispatcher) {
            if (dispatcher.services.down.length > 0) {
                return true;
            }
            else if (dispatcher.queues.ingest >= dispatcher.queues.max_inflight && dispatcher.enabled) {
                return true;
            }
            else if (dispatcher.queues.response >= dispatcher.queues.max_inflight && dispatcher.enabled) {
                return true;
            }
            return false;
        };

        $scope.$on('socket:ServiceHeartbeat', function (event, data) {
            var cur_time = new Date().getTime();

            try {
                console.log('Socket-IO::ServiceHeartbeat message', data);
                if (data.body.services === undefined || data.body.services == null) return;
                $scope.service_expiry[data.body.mac] = cur_time;

                delete $scope.service_running[data.body.mac];
                $scope.service_running[data.body.mac] = {};
                for (var service in data.body.services.details) {
                    $scope.service_running[data.body.mac][service] = data.body.services.details[service].num_workers;

                    var running = $scope.running_workers(service);
                    $scope.data.services[service].errors.under_provisioned = running < $scope.data.services[service].workers;
                }
            }
            catch (e) {
                console.log('Socket-IO::ServiceHeartbeat [ERROR] Invalid message', data, e);
            }

        });

        $scope.dump = function (obj) {
            return angular.toJson(obj, true);
        };

        $scope.$on('socket:monitoring', function (event, data) {
            $scope.socket_status = 'ok';
            console.log('Socket-IO::Connected', data);
        });

        $scope.update_service_info = function () {
            $scope.pull_expiry_status();
            $scope.pull_service_queues();
            $scope.pull_expire_heartbeats();
        };

        $scope.pull_expire_heartbeats = function () {
            var timer = 10000;
            var cur_time = new Date().getTime();

            for (var mac in $scope.service_expiry) {
                var expiry = $scope.service_expiry[mac];
                if ((expiry + timer - cur_time) < 0) {
                    delete $scope.service_running[mac];
                    delete $scope.service_expiry[mac];
                }
            }
            $timeout(function () {
                $scope.pull_expire_heartbeats()
            }, 500);
        };

        $scope.pull_service_queues = function () {
            $http({
                method: 'GET',
                url: "/api/v3/dashboard/queues/"
            })
                .success(function (data) {

                    for (var service in data.api_response) {
                        $scope.data.services[service].queue = data.api_response[service];
                        $scope.data.services[service].errors.over_queued = $scope.data.services[service].queue > ($scope.data.dispatchers_stat.outstanding / 2);
                    }

                    $timeout(function () {
                        $scope.pull_service_queues()
                    }, 5000);
                })
                .error(function (data) {
                    if (data == "") {
                        return;
                    }
                    $timeout(function () {
                        $scope.pull_service_queues()
                    }, 5000);
                });
        };

        $scope.pull_expiry_status = function () {
            $http({
                method: 'GET',
                url: "/api/v3/dashboard/expiry/"
            })
                .success(function (data) {
                    $scope.expiry_late = [];
                    for (var service in data.api_response) {
                        if (!data.api_response[service]) {
                            $scope.expiry_late.push(service)
                        }
                    }

                    $timeout(function () {
                        $scope.pull_expiry_status()
                    }, 5000);
                })
                .error(function (data) {
                    if (data == "") {
                        return;
                    }
                    $timeout(function () {
                        $scope.pull_expiry_status()
                    }, 5000);
                });
        };

        $scope.has_errors = function (service) {
            var in_error = false;
            if (service.errors.marked_down || service.errors.under_provisioned || service.errors.over_queued || service.errors.not_reported) {
                in_error = true;
            }
            return in_error;
        };

        $scope.running_workers = function (service) {
            var running = 0;
            for (var mac in $scope.service_running) {
                var temp = $scope.service_running[mac][service];
                if (temp !== undefined) {
                    running += temp;
                }
            }

            return running;
        };

        $scope.report_status = function (service) {
            if ($scope.data.services[service].errors.not_reported) {
                return "N/A"
            }
            else if ($scope.data.services[service].errors.not_provisioned) {
                return "OFF";
            }
            else if ($scope.data.services[service].errors.marked_down) {
                return "Down";
            }
            else {
                return "OK";
            }
        };

        //Error handling
        $scope.error = '';
        $scope.success = '';

        //Data functions
        $scope.load_data = function () {
            $scope.loading = true;

            $http({
                method: 'GET',
                url: "/api/v3/dashboard/services/"
            })
                .success(function (data) {
                    $scope.loading = false;
                    $scope.data.services = data.api_response;
                    for (var s in $scope.data.services) {
                        $scope.data.services[s].name = s;
                        $scope.data.services[s].errors = {
                            marked_down: false,
                            under_provisioned: false,
                            over_queued: false,
                            not_provisioned: false,
                            not_reported: true
                        };
                    }
                    $timeout(function () {
                        $scope.update_service_info()
                    }, 5000);
                })
                .error(function (data, status, headers, config) {
                    if (data == "") {
                        return;
                    }

                    $scope.loading = false;

                    if (data.api_error_message) {
                        $scope.error = data.api_error_message;
                    }
                    else {
                        $scope.error = config.url + " (" + status + ")";
                    }
                });

            $http({
                method: 'GET',
                url: "/api/v3/dashboard/shards/"
            })
                .success(function (data) {
                    $scope.loading = false;
                    $scope.dispatcher_shards_count = data.api_response.dispatcher;
                    $scope.ingester_shards_count = data.api_response.ingester;
                    $scope.data.shards = Array.apply(null, new Array($scope.dispatcher_shards_count)).map(function (_, i) {
                        return {
                            id: i,
                            entries: 0,
                            enabled: false,
                            services: {up: [], down: [], not_provisioned: []},
                            queues: {control: 0, response: 0, max_inflight: 0, ingest: 0}
                        }
                    })
                })
                .error(function (data, status, headers, config) {
                    if (data == "") {
                        return;
                    }

                    $scope.loading = false;

                    if (data.api_error_message) {
                        $scope.error = data.api_error_message;
                    }
                    else {
                        $scope.error = config.url + " (" + status + ")";
                    }
                });

        };

        //Startup
        $scope.start = function () {
            $scope.load_data();
            console.log("STARTED!");

            $scope.cpu_gauge = create_gauge('cpu');
            $scope.cpu_gauge.render();
            $scope.cpu_gauge.moveTo(0);
            $scope.ram_gauge = create_gauge('ram');
            $scope.ram_gauge.render();
            $scope.ram_gauge.moveTo(0);
        };
    });


