"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicChannelManager = void 0;
class PublicChannelManager {
    constructor(server) {
        this.server = server;
    }
    join(ws, channel, message) {
        if (!ws.app) {
            return Promise.resolve({
                ws,
                success: false,
                errorCode: 4007,
                errorMessage: 'Subscriptions messages should be sent after the pusher:connection_established event is received.',
            });
        }
        return this.server.adapter.addToChannel(ws.app.id, channel, ws).then(connections => {
            return {
                ws,
                success: true,
                channelConnections: connections,
            };
        });
    }
    leave(ws, channel) {
        return this.server.adapter.removeFromChannel(ws.app.id, channel, ws.id).then((remainingConnections) => {
            return {
                left: true,
                remainingConnections,
            };
        });
    }
}
exports.PublicChannelManager = PublicChannelManager;
