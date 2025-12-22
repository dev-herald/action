"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const validation_1 = require("./validation");
const api_1 = require("./api");
const output_1 = require("./output");
/**
 * Main action entry point
 */
async function run() {
    try {
        // ============================================================
        // PHASE 1: INPUT VALIDATION (before API call)
        // ============================================================
        core.info('🔍 Validating inputs...');
        const inputs = (0, validation_1.getActionInputs)();
        (0, validation_1.validateInputs)(inputs);
        core.info('✅ Input validation passed');
        // Build and validate request configuration
        const config = (0, validation_1.buildRequestConfig)(inputs);
        // ============================================================
        // PHASE 2: API REQUEST
        // ============================================================
        core.info(`🚀 Posting to PR #${inputs.prNumber}`);
        core.info(`📡 Endpoint: ${config.endpoint}`);
        core.debug(`📦 Request body: ${JSON.stringify(config.requestBody, null, 2)}`);
        const headers = (0, api_1.buildHeaders)(inputs.apiKey);
        const response = await (0, api_1.makeHttpRequest)(config.endpoint, 'POST', headers, config.requestBody);
        // ============================================================
        // PHASE 3: RESPONSE PROCESSING (after API call)
        // ============================================================
        (0, output_1.processResponse)(response, config.mode);
    }
    catch (error) {
        if (error instanceof Error) {
            // Error message is already formatted (from Zod validation or API error handling)
            core.setFailed(error.message);
        }
        else {
            core.setFailed('❌ Unknown error occurred');
        }
    }
}
run();
