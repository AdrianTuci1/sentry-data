"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const projects_1 = __importDefault(require("./projects"));
const orchestration_1 = __importDefault(require("./orchestration"));
const layers_1 = __importDefault(require("./layers"));
const webhooks_1 = __importDefault(require("./webhooks"));
const router = (0, express_1.Router)();
router.use('/projects', projects_1.default);
router.use('/orchestration', orchestration_1.default);
router.use('/layers', layers_1.default);
router.use('/webhooks', webhooks_1.default);
exports.default = router;
