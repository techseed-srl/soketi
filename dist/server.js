"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
const dot = require("dot-wild");
const adapters_1 = require("./adapters");
const app_managers_1 = require("./app-managers");
const cache_manager_1 = require("./cache-managers/cache-manager");
const http_handler_1 = require("./http-handler");
const log_1 = require("./log");
const metrics_1 = require("./metrics");
const queue_1 = require("./queues/queue");
const rate_limiter_1 = require("./rate-limiters/rate-limiter");
const uuid_1 = require("uuid");
const webhook_sender_1 = require("./webhook-sender");
const ws_handler_1 = require("./ws-handler");
const Discover = require('node-discover');
const queryString = require('query-string');
const uWS = require('uWebSockets.js');
class Server {
    constructor(options = {}) {
        this.options = {
            adapter: {
                driver: 'local',
                redis: {
                    requestsTimeout: 5000,
                    prefix: '',
                    redisPubOptions: {},
                    redisSubOptions: {},
                    clusterMode: false,
                },
                cluster: {
                    requestsTimeout: 5000,
                },
                nats: {
                    requestsTimeout: 5000,
                    prefix: '',
                    servers: ['127.0.0.1:4222'],
                    user: null,
                    pass: null,
                    token: null,
                    timeout: 10000,
                    nodesNumber: null,
                },
            },
            appManager: {
                driver: 'array',
                cache: {
                    enabled: false,
                    ttl: -1,
                },
                array: {
                    apps: [
                        {
                            id: 'app-id',
                            key: 'app-key',
                            secret: 'app-secret',
                            maxConnections: -1,
                            enableClientMessages: false,
                            enabled: true,
                            maxBackendEventsPerSecond: -1,
                            maxClientEventsPerSecond: -1,
                            maxReadRequestsPerSecond: -1,
                            webhooks: [],
                        },
                    ],
                },
                dynamodb: {
                    table: 'apps',
                    region: 'us-east-1',
                    endpoint: null,
                },
                mysql: {
                    table: 'apps',
                    version: '8.0',
                    useMysql2: false,
                },
                postgres: {
                    table: 'apps',
                    version: '13.3',
                },
            },
            cache: {
                driver: 'memory',
            },
            channelLimits: {
                maxNameLength: 200,
            },
            cluster: {
                hostname: '0.0.0.0',
                helloInterval: 500,
                checkInterval: 500,
                nodeTimeout: 2000,
                masterTimeout: 2000,
                port: 11002,
                prefix: '',
                ignoreProcess: true,
                broadcast: '255.255.255.255',
                unicast: null,
                multicast: null,
            },
            cors: {
                credentials: true,
                origin: ['*'],
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: [
                    'Origin',
                    'Content-Type',
                    'X-Auth-Token',
                    'X-Requested-With',
                    'Accept',
                    'Authorization',
                    'X-CSRF-TOKEN',
                    'XSRF-TOKEN',
                    'X-Socket-Id',
                ],
            },
            database: {
                mysql: {
                    host: '127.0.0.1',
                    port: 3306,
                    user: 'root',
                    password: 'password',
                    database: 'main',
                },
                postgres: {
                    host: '127.0.0.1',
                    port: 5432,
                    user: 'postgres',
                    password: 'password',
                    database: 'main',
                },
                redis: {
                    host: '127.0.0.1',
                    port: 6379,
                    db: 0,
                    username: null,
                    password: null,
                    keyPrefix: '',
                    sentinels: null,
                    sentinelPassword: null,
                    name: 'mymaster',
                    clusterNodes: [],
                },
            },
            databasePooling: {
                enabled: false,
                min: 0,
                max: 7,
            },
            debug: false,
            eventLimits: {
                maxChannelsAtOnce: 100,
                maxNameLength: 200,
                maxPayloadInKb: 100,
                maxBatchSize: 10,
            },
            httpApi: {
                requestLimitInMb: 100,
                acceptTraffic: {
                    memoryThreshold: 85,
                },
            },
            instance: {
                process_id: process.pid || (0, uuid_1.v4)(),
            },
            metrics: {
                enabled: false,
                driver: 'prometheus',
                prometheus: {
                    prefix: 'soketi_',
                },
                port: 9601,
            },
            mode: 'full',
            port: 6001,
            pathPrefix: '',
            presence: {
                maxMembersPerChannel: 100,
                maxMemberSizeInKb: 2,
            },
            queue: {
                driver: 'sync',
                redis: {
                    concurrency: 1,
                    redisOptions: {},
                    clusterMode: false,
                },
                sqs: {
                    region: 'us-east-1',
                    endpoint: null,
                    clientOptions: {},
                    consumerOptions: {},
                    queueUrl: '',
                    processBatch: false,
                    batchSize: 1,
                    pollingWaitTimeMs: 0,
                },
            },
            rateLimiter: {
                driver: 'local',
                redis: {
                    redisOptions: {},
                    clusterMode: false,
                },
            },
            shutdownGracePeriod: 3000,
            ssl: {
                certPath: '',
                keyPath: '',
                passphrase: '',
                caPath: '',
            },
            webhooks: {
                batching: {
                    enabled: false,
                    duration: 50,
                },
            },
        };
        this.closing = false;
        this.pm2 = false;
        this.nodes = new Map();
        this.setOptions(options);
    }
    static async start(options = {}, callback) {
        return (new Server(options)).start(callback);
    }
    async start(callback) {
        log_1.Log.br();
        this.configureDiscovery().then(() => {
            this.initializeDrivers().then(() => {
                if (this.options.debug) {
                    console.dir(this.options, { depth: 100 });
                }
                this.wsHandler = new ws_handler_1.WsHandler(this);
                this.httpHandler = new http_handler_1.HttpHandler(this);
                if (this.options.debug) {
                    log_1.Log.info('📡 soketi initialization....');
                    log_1.Log.info('⚡ Initializing the HTTP API & Websockets Server...');
                }
                let server = this.shouldConfigureSsl()
                    ? uWS.SSLApp({
                        key_file_name: this.options.ssl.keyPath,
                        cert_file_name: this.options.ssl.certPath,
                        passphrase: this.options.ssl.passphrase,
                        ca_file_name: this.options.ssl.caPath,
                    })
                    : uWS.App();
                let metricsServer = uWS.App();
                if (this.options.debug) {
                    log_1.Log.info('⚡ Initializing the Websocket listeners and channels...');
                }
                this.appManager.listApps().then(apps => apps.forEach(app => this.webhookSender.sendServerStartup(app)));
                this.configureWebsockets(server).then(server => {
                    if (this.options.debug) {
                        log_1.Log.info('⚡ Initializing the HTTP webserver...');
                    }
                    this.configureHttp(server).then(server => {
                        this.configureMetricsServer(metricsServer).then(metricsServer => {
                            metricsServer.listen('0.0.0.0', this.options.metrics.port, metricsServerProcess => {
                                this.metricsServerProcess = metricsServerProcess;
                                server.listen('0.0.0.0', this.options.port, serverProcess => {
                                    this.serverProcess = serverProcess;
                                    log_1.Log.successTitle('🎉 Server is up and running!');
                                    log_1.Log.successTitle(`📡 The Websockets server is available at 127.0.0.1:${this.options.port}`);
                                    log_1.Log.successTitle(`🔗 The HTTP API server is available at http://127.0.0.1:${this.options.port}`);
                                    log_1.Log.successTitle(`🎊 The /usage endpoint is available on port ${this.options.metrics.port}.`);
                                    if (this.options.metrics.enabled) {
                                        log_1.Log.successTitle(`🌠 Prometheus /metrics endpoint is available on port ${this.options.metrics.port}.`);
                                    }
                                    log_1.Log.br();
                                    if (callback) {
                                        callback(this);
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
    }
    stop() {
        this.closing = true;
        log_1.Log.br();
        log_1.Log.warning('🚫 New users cannot connect to this instance anymore. Preparing for signaling...');
        log_1.Log.warning('⚡ The server is closing and signaling the existing connections to terminate.');
        log_1.Log.br();
        return this.wsHandler.closeAllLocalSockets().then(() => {
            return new Promise(resolve => {
                if (this.options.debug) {
                    log_1.Log.warningTitle('⚡ All sockets were closed. Now closing the server.');
                }
                if (this.serverProcess) {
                    uWS.us_listen_socket_close(this.serverProcess);
                }
                if (this.metricsServerProcess) {
                    uWS.us_listen_socket_close(this.metricsServerProcess);
                }
                setTimeout(() => {
                    Promise.all([
                        this.metricsManager.clear(),
                        this.queueManager.disconnect(),
                        this.rateLimiter.disconnect(),
                        this.cacheManager.disconnect(),
                    ]).then(() => {
                        this.adapter.disconnect().then(() => resolve());
                    });
                }, this.options.shutdownGracePeriod);
            });
        });
    }
    setOptions(options) {
        for (let optionKey in options) {
            if (optionKey.match("^appManager.array.apps.\\d+.id")) {
                if (Number.isInteger(options[optionKey])) {
                    options[optionKey] = options[optionKey].toString();
                }
            }
            this.options = dot.set(this.options, optionKey, options[optionKey]);
        }
    }
    initializeDrivers() {
        return Promise.all([
            this.setAppManager(new app_managers_1.AppManager(this)),
            this.setAdapter(new adapters_1.Adapter(this)),
            this.setMetricsManager(new metrics_1.Metrics(this)),
            this.setRateLimiter(new rate_limiter_1.RateLimiter(this)),
            this.setQueueManager(new queue_1.Queue(this)),
            this.setCacheManager(new cache_manager_1.CacheManager(this)),
            this.setWebhookSender(),
        ]);
    }
    setAppManager(instance) {
        this.appManager = instance;
    }
    setAdapter(instance) {
        return new Promise(resolve => {
            instance.init().then(() => {
                this.adapter = instance;
                resolve();
            });
        });
    }
    setMetricsManager(instance) {
        return new Promise(resolve => {
            this.metricsManager = instance;
            resolve();
        });
    }
    setRateLimiter(instance) {
        return new Promise(resolve => {
            this.rateLimiter = instance;
            resolve();
        });
    }
    setQueueManager(instance) {
        return new Promise(resolve => {
            this.queueManager = instance;
            resolve();
        });
    }
    setCacheManager(instance) {
        return new Promise(resolve => {
            this.cacheManager = instance;
            resolve();
        });
    }
    setWebhookSender() {
        return new Promise(resolve => {
            this.webhookSender = new webhook_sender_1.WebhookSender(this);
            resolve();
        });
    }
    url(path) {
        return this.options.pathPrefix + path;
    }
    clusterPrefix(channel) {
        if (this.options.cluster.prefix) {
            channel = this.options.cluster.prefix + '#' + channel;
        }
        return channel;
    }
    configureDiscovery() {
        return new Promise(resolve => {
            this.discover = Discover(this.options.cluster, () => {
                this.nodes.set('self', this.discover.me);
                this.discover.on('promotion', () => {
                    this.nodes.set('self', this.discover.me);
                    if (this.options.debug) {
                        log_1.Log.discoverTitle('Promoted from node to master.');
                        log_1.Log.discover(this.discover.me);
                    }
                });
                this.discover.on('demotion', () => {
                    this.nodes.set('self', this.discover.me);
                    if (this.options.debug) {
                        log_1.Log.discoverTitle('Demoted from master to node.');
                        log_1.Log.discover(this.discover.me);
                    }
                });
                this.discover.on('added', (node) => {
                    this.nodes.set('self', this.discover.me);
                    this.nodes.set(node.id, node);
                    if (this.options.debug) {
                        log_1.Log.discoverTitle('New node added.');
                        log_1.Log.discover(node);
                    }
                });
                this.discover.on('removed', (node) => {
                    this.nodes.set('self', this.discover.me);
                    this.nodes.delete(node.id);
                    if (this.options.debug) {
                        log_1.Log.discoverTitle('Node removed.');
                        log_1.Log.discover(node);
                    }
                });
                this.discover.on('master', (node) => {
                    this.nodes.set('self', this.discover.me);
                    this.nodes.set(node.id, node);
                    if (this.options.debug) {
                        log_1.Log.discoverTitle('New master.');
                        log_1.Log.discover(node);
                    }
                });
                resolve();
            });
        });
    }
    configureWebsockets(server) {
        return new Promise(resolve => {
            if (this.canProcessRequests()) {
                server = server.ws(this.url('/app/:id'), {
                    idleTimeout: 120,
                    maxBackpressure: 1024 * 1024,
                    maxPayloadLength: 100 * 1024 * 1024,
                    message: (ws, message, isBinary) => this.wsHandler.onMessage(ws, message, isBinary),
                    open: (ws) => this.wsHandler.onOpen(ws),
                    close: (ws, code, message) => this.wsHandler.onClose(ws, code, message),
                    upgrade: (res, req, context) => this.wsHandler.handleUpgrade(res, req, context),
                });
            }
            resolve(server);
        });
    }
    configureHttp(server) {
        return new Promise(resolve => {
            server.get(this.url('/'), (res, req) => this.httpHandler.healthCheck(res));
            server.get(this.url('/ready'), (res, req) => this.httpHandler.ready(res));
            if (this.canProcessRequests()) {
                server.get(this.url('/accept-traffic'), (res, req) => this.httpHandler.acceptTraffic(res));
                server.get(this.url('/apps/:appId/channels'), (res, req) => {
                    res.params = { appId: req.getParameter(0) };
                    res.query = queryString.parse(req.getQuery());
                    res.method = req.getMethod().toUpperCase();
                    res.url = req.getUrl();
                    return this.httpHandler.channels(res);
                });
                server.get(this.url('/apps/:appId/channels/:channelName'), (res, req) => {
                    res.params = { appId: req.getParameter(0), channel: req.getParameter(1) };
                    res.query = queryString.parse(req.getQuery());
                    res.method = req.getMethod().toUpperCase();
                    res.url = req.getUrl();
                    return this.httpHandler.channel(res);
                });
                server.get(this.url('/apps/:appId/channels/:channelName/users'), (res, req) => {
                    res.params = { appId: req.getParameter(0), channel: req.getParameter(1) };
                    res.query = queryString.parse(req.getQuery());
                    res.method = req.getMethod().toUpperCase();
                    res.url = req.getUrl();
                    return this.httpHandler.channelUsers(res);
                });
                server.post(this.url('/apps/:appId/events'), (res, req) => {
                    res.params = { appId: req.getParameter(0) };
                    res.query = queryString.parse(req.getQuery());
                    res.method = req.getMethod().toUpperCase();
                    res.url = req.getUrl();
                    return this.httpHandler.events(res);
                });
                server.post(this.url('/apps/:appId/batch_events'), (res, req) => {
                    res.params = { appId: req.getParameter(0) };
                    res.query = queryString.parse(req.getQuery());
                    res.method = req.getMethod().toUpperCase();
                    res.url = req.getUrl();
                    return this.httpHandler.batchEvents(res);
                });
            }
            server.any(this.url('/*'), (res, req) => {
                return this.httpHandler.notFound(res);
            });
            resolve(server);
        });
    }
    configureMetricsServer(metricsServer) {
        return new Promise(resolve => {
            log_1.Log.info('🕵️‍♂️ Initiating metrics endpoints...');
            log_1.Log.br();
            metricsServer.get(this.url('/'), (res, req) => this.httpHandler.healthCheck(res));
            metricsServer.get(this.url('/ready'), (res, req) => this.httpHandler.ready(res));
            metricsServer.get(this.url('/usage'), (res, req) => this.httpHandler.usage(res));
            if (this.options.metrics.enabled) {
                metricsServer.get(this.url('/metrics'), (res, req) => {
                    res.query = queryString.parse(req.getQuery());
                    return this.httpHandler.metrics(res);
                });
            }
            resolve(metricsServer);
        });
    }
    shouldConfigureSsl() {
        return this.options.ssl.certPath !== '' ||
            this.options.ssl.keyPath !== '';
    }
    canProcessQueues() {
        return ['worker', 'full'].includes(this.options.mode);
    }
    canProcessRequests() {
        return ['server', 'full'].includes(this.options.mode);
    }
}
exports.Server = Server;
