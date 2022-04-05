"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const Pusher = require('pusher');
const pusherUtil = require('pusher/lib/util');
class App {
    constructor(initialApp, server) {
        this.initialApp = initialApp;
        this.server = server;
        this.hasServerStartupWebhooks = false;
        this.hasClientEventWebhooks = false;
        this.hasChannelOccupiedWebhooks = false;
        this.hasChannelVacatedWebhooks = false;
        this.hasSubscriptionSuccededWebhooks = false;
        this.hasSubscriptionClosedWebhooks = false;
        this.hasMemberAddedWebhooks = false;
        this.hasMemberRemovedWebhooks = false;
        this.id = this.extractFromPassedKeys(initialApp, ['id', 'AppId'], 'app-id');
        this.key = this.extractFromPassedKeys(initialApp, ['key', 'AppKey'], 'app-key');
        this.secret = this.extractFromPassedKeys(initialApp, ['secret', 'AppSecret'], 'app-secret');
        this.maxConnections = this.extractFromPassedKeys(initialApp, ['maxConnections', 'MaxConnections', 'max_connections'], -1);
        this.enableClientMessages = this.extractFromPassedKeys(initialApp, ['enableClientMessages', 'EnableClientMessages', 'enable_client_messages'], false);
        this.enabled = this.extractFromPassedKeys(initialApp, ['enabled', 'Enabled'], true);
        this.maxBackendEventsPerSecond = parseInt(this.extractFromPassedKeys(initialApp, ['maxBackendEventsPerSecond', 'MaxBackendEventsPerSecond', 'max_backend_events_per_sec'], -1));
        this.maxClientEventsPerSecond = parseInt(this.extractFromPassedKeys(initialApp, ['maxClientEventsPerSecond', 'MaxClientEventsPerSecond', 'max_client_events_per_sec'], -1));
        this.maxReadRequestsPerSecond = parseInt(this.extractFromPassedKeys(initialApp, ['maxReadRequestsPerSecond', 'MaxReadRequestsPerSecond', 'max_read_req_per_sec'], -1));
        this.webhooks = this.transformPotentialJsonToArray(this.extractFromPassedKeys(initialApp, ['webhooks', 'Webhooks'], '[]'));
        this.maxPresenceMembersPerChannel = parseInt(this.extractFromPassedKeys(initialApp, ['maxPresenceMembersPerChannel', 'MaxPresenceMembersPerChannel', 'max_presence_members_per_channel'], server.options.presence.maxMembersPerChannel));
        this.maxPresenceMemberSizeInKb = parseFloat(this.extractFromPassedKeys(initialApp, ['maxPresenceMemberSizeInKb', 'MaxPresenceMemberSizeInKb', 'max_presence_member_size_in_kb'], server.options.presence.maxMemberSizeInKb));
        this.maxChannelNameLength = parseInt(this.extractFromPassedKeys(initialApp, ['maxChannelNameLength', 'MaxChannelNameLength', 'max_channel_name_length'], server.options.channelLimits.maxNameLength));
        this.maxEventChannelsAtOnce = parseInt(this.extractFromPassedKeys(initialApp, ['maxEventChannelsAtOnce', 'MaxEventChannelsAtOnce', 'max_event_channels_at_once'], server.options.eventLimits.maxChannelsAtOnce));
        this.maxEventNameLength = parseInt(this.extractFromPassedKeys(initialApp, ['maxEventNameLength', 'MaxEventNameLength', 'max_event_name_length'], server.options.eventLimits.maxNameLength));
        this.maxEventPayloadInKb = parseFloat(this.extractFromPassedKeys(initialApp, ['maxEventPayloadInKb', 'MaxEventPayloadInKb', 'max_event_payload_in_kb'], server.options.eventLimits.maxPayloadInKb));
        this.maxEventBatchSize = parseInt(this.extractFromPassedKeys(initialApp, ['maxEventBatchSize', 'MaxEventBatchSize', 'max_event_batch_size'], server.options.eventLimits.maxBatchSize));
        this.hasClientEventWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.CLIENT_EVENT_WEBHOOK)).length > 0;
        this.hasChannelOccupiedWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.CHANNEL_OCCUPIED_WEBHOOK)).length > 0;
        this.hasChannelVacatedWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.CHANNEL_VACATED_WEBHOOK)).length > 0;
        this.hasSubscriptionSuccededWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.SUBSCRIPTION_SUCCEDED_WEBHOOK)).length > 0;
        this.hasSubscriptionClosedWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.SUBSCRIPTION_CLOSED_WEBHOOK)).length > 0;
        this.hasMemberAddedWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.MEMBER_ADDED_WEBHOOK)).length > 0;
        this.hasMemberRemovedWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.MEMBER_REMOVED_WEBHOOK)).length > 0;
        this.hasServerStartupWebhooks = this.webhooks.filter(webhook => webhook.event_types.includes(App.SERVER_STARTUP_WEBHOOK)).length > 0;
    }
    forWebSocket() {
        let app = new App(this.initialApp, this.server);
        delete app.maxBackendEventsPerSecond;
        delete app.maxReadRequestsPerSecond;
        delete app.webhooks;
        return app;
    }
    signingTokenFromRequest(res) {
        const params = {
            auth_key: this.key,
            auth_timestamp: res.query.auth_timestamp,
            auth_version: res.query.auth_version,
            ...res.query,
        };
        delete params['auth_signature'];
        delete params['body_md5'];
        delete params['appId'];
        delete params['appKey'];
        delete params['channelName'];
        if (res.rawBody) {
            params['body_md5'] = pusherUtil.getMD5(res.rawBody);
        }
        return this.signingToken(res.method, res.url, pusherUtil.toOrderedArray(params).join('&'));
    }
    signingToken(method, path, params) {
        let token = new Pusher.Token(this.key, this.secret);
        return token.sign([method, path, params].join("\n"));
    }
    extractFromPassedKeys(app, parameters, defaultValue) {
        let extractedValue = defaultValue;
        parameters.forEach(param => {
            if (typeof app[param] !== 'undefined' && !['', null].includes(app[param])) {
                extractedValue = app[param];
            }
        });
        return extractedValue;
    }
    transformPotentialJsonToArray(potentialJson) {
        if (potentialJson instanceof Array) {
            return potentialJson;
        }
        try {
            let potentialArray = JSON.parse(potentialJson);
            if (potentialArray instanceof Array) {
                return potentialArray;
            }
        }
        catch (e) {
        }
        return [];
    }
}
exports.App = App;
App.SERVER_STARTUP_WEBHOOK = 'server_startup';
App.CLIENT_EVENT_WEBHOOK = 'client_event';
App.CHANNEL_OCCUPIED_WEBHOOK = 'channel_occupied';
App.CHANNEL_VACATED_WEBHOOK = 'channel_vacated';
App.SUBSCRIPTION_SUCCEDED_WEBHOOK = 'subscription_succeded';
App.SUBSCRIPTION_CLOSED_WEBHOOK = 'subscription_closed';
App.MEMBER_ADDED_WEBHOOK = 'member_added';
App.MEMBER_REMOVED_WEBHOOK = 'member_removed';
