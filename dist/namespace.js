"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Namespace = void 0;
class Namespace {
    constructor(appId) {
        this.appId = appId;
        this.channels = new Map();
        this.sockets = new Map();
    }
    getSockets() {
        return Promise.resolve(this.sockets);
    }
    addSocket(ws) {
        return new Promise(resolve => {
            this.sockets.set(ws.id, ws);
            resolve(true);
        });
    }
    async removeSocket(wsId) {
        for (let channel of this.channels.keys()) {
            this.removeFromChannel(wsId, channel);
        }
        return this.sockets.delete(wsId);
    }
    addToChannel(ws, channel) {
        return new Promise(resolve => {
            if (!this.channels.has(channel)) {
                this.channels.set(channel, new Set);
            }
            this.channels.get(channel).add(ws.id);
            resolve(this.channels.get(channel).size);
        });
    }
    async removeFromChannel(wsId, channel) {
        return new Promise(resolve => {
            if (this.channels.has(channel)) {
                this.channels.get(channel).delete(wsId);
                if (this.channels.get(channel).size === 0) {
                    this.channels.delete(channel);
                }
            }
            resolve(this.channels.has(channel) ? this.channels.get(channel).size : 0);
        });
    }
    isInChannel(wsId, channel) {
        return new Promise(resolve => {
            if (!this.channels.has(channel)) {
                return resolve(false);
            }
            resolve(this.channels.get(channel).has(wsId));
        });
    }
    getChannels() {
        return Promise.resolve(this.channels);
    }
    getChannelSockets(channel) {
        return new Promise(resolve => {
            if (!this.channels.has(channel)) {
                return resolve(new Map());
            }
            let wsIds = this.channels.get(channel);
            resolve(Array.from(wsIds).reduce((sockets, wsId) => {
                if (!this.sockets.has(wsId)) {
                    return sockets;
                }
                return sockets.set(wsId, this.sockets.get(wsId));
            }, new Map()));
        });
    }
    getChannelMembers(channel) {
        return this.getChannelSockets(channel).then(sockets => {
            return Array.from(sockets).reduce((members, [wsId, ws]) => {
                let member = ws.presence ? ws.presence.get(channel) : null;
                if (member) {
                    members.set(member.user_id, member.user_info);
                }
                return members;
            }, new Map());
        });
    }
}
exports.Namespace = Namespace;
