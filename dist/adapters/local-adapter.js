"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalAdapter = void 0;
const namespace_1 = require("../namespace");
class LocalAdapter {
    constructor(server) {
        this.server = server;
        this.namespaces = new Map();
    }
    async init() {
        return Promise.resolve(this);
    }
    getNamespace(appId) {
        if (!this.namespaces.has(appId)) {
            this.namespaces.set(appId, new namespace_1.Namespace(appId));
        }
        return this.namespaces.get(appId);
    }
    getNamespaces() {
        return this.namespaces;
    }
    async addSocket(appId, ws) {
        return this.getNamespace(appId).addSocket(ws);
    }
    async removeSocket(appId, wsId) {
        return this.getNamespace(appId).removeSocket(wsId);
    }
    async addToChannel(appId, channel, ws) {
        return this.getNamespace(appId).addToChannel(ws, channel).then(() => {
            return this.getChannelSocketsCount(appId, channel);
        });
    }
    async removeFromChannel(appId, channel, wsId) {
        return this.getNamespace(appId).removeFromChannel(wsId, channel).then(() => {
            return this.getChannelSocketsCount(appId, channel);
        });
    }
    async getSockets(appId, onlyLocal = false) {
        return this.getNamespace(appId).getSockets();
    }
    async getSocketsCount(appId, onlyLocal) {
        return this.getNamespace(appId).getSockets().then(sockets => {
            return sockets.size;
        });
    }
    async getChannels(appId, onlyLocal = false) {
        return this.getNamespace(appId).getChannels();
    }
    async getChannelSockets(appId, channel, onlyLocal = false) {
        return this.getNamespace(appId).getChannelSockets(channel);
    }
    async getChannelSocketsCount(appId, channel, onlyLocal) {
        return this.getNamespace(appId).getChannelSockets(channel).then(sockets => {
            return sockets.size;
        });
    }
    async getChannelMembers(appId, channel, onlyLocal = false) {
        return this.getNamespace(appId).getChannelMembers(channel);
    }
    async getChannelMembersCount(appId, channel, onlyLocal) {
        return this.getNamespace(appId).getChannelMembers(channel).then(members => {
            return members.size;
        });
    }
    async isInChannel(appId, channel, wsId, onlyLocal) {
        return this.getNamespace(appId).isInChannel(wsId, channel);
    }
    send(appId, channel, data, exceptingId = null) {
        this.getNamespace(appId).getChannelSockets(channel).then(sockets => {
            sockets.forEach((ws) => {
                if (exceptingId && exceptingId === ws.id) {
                    return;
                }
                if (ws.sendJson) {
                    ws.sendJson(JSON.parse(data));
                }
            });
        });
    }
    disconnect() {
        return Promise.resolve();
    }
    clearNamespace(namespaceId) {
        this.namespaces.set(namespaceId, new namespace_1.Namespace(namespaceId));
        return Promise.resolve();
    }
    clearNamespaces() {
        this.namespaces = new Map();
        return Promise.resolve();
    }
}
exports.LocalAdapter = LocalAdapter;
