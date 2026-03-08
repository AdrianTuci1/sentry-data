"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const express_1 = require("express");
// A simple Health Controller to verify our DI setup is working
class HealthController {
    constructor() {
        this.path = '/sys';
        this.router = (0, express_1.Router)();
        this.pong = (req, res) => {
            res.status(200).json({ status: 'Container and Routing are Healthy!' });
        };
        this.initRoutes();
    }
    initRoutes() {
        console.log(`[Route Mounted] ${this.path}/ping`);
        this.router.get('/ping', this.pong);
    }
}
exports.HealthController = HealthController;
