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
exports.getActionInputs = getActionInputs;
exports.validatePrNumber = validatePrNumber;
exports.validateModeSelection = validateModeSelection;
exports.validateTemplateInput = validateTemplateInput;
exports.buildRequestConfig = buildRequestConfig;
const core = __importStar(require("@actions/core"));
const VALID_TEMPLATES = ['DEPLOYMENT', 'TEST_RESULTS', 'MIGRATION', 'CUSTOM_TABLE'];
/**
 * Reads and returns all action inputs
 */
function getActionInputs() {
    return {
        apiKey: core.getInput('api-key', { required: true }),
        prNumber: parseInt(core.getInput('pr-number', { required: true }), 10),
        comment: core.getInput('comment', { required: false }),
        template: core.getInput('template', { required: false }),
        templateData: core.getInput('template-data', { required: false }),
        stickyId: core.getInput('sticky-id', { required: false }),
        apiUrl: core.getInput('api-url', { required: false }) || 'https://api.devherald.com/api/v1/github'
    };
}
/**
 * Validates the PR number is a positive integer
 */
function validatePrNumber(prNumber, prNumberInput) {
    if (isNaN(prNumber) || prNumber <= 0) {
        throw new Error(`Invalid pr-number: must be a positive integer, got "${prNumberInput}"`);
    }
}
/**
 * Validates that exactly one mode (comment or template) is selected
 */
function validateModeSelection(hasComment, hasTemplate) {
    if (!hasComment && !hasTemplate) {
        throw new Error('Must provide either "comment" (for simple comments) or "template" (for template comments)');
    }
    if (hasComment && hasTemplate) {
        throw new Error('Cannot provide both "comment" and "template" - choose one mode');
    }
}
/**
 * Validates template input and returns parsed data
 */
function validateTemplateInput(template, templateData) {
    if (!VALID_TEMPLATES.includes(template)) {
        throw new Error(`Invalid template: must be one of ${VALID_TEMPLATES.join(', ')}, got "${template}"`);
    }
    if (!templateData || templateData.trim().length === 0) {
        throw new Error('template-data is required when using template mode');
    }
    try {
        return JSON.parse(templateData);
    }
    catch (error) {
        throw new Error(`Invalid JSON in template-data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Builds the request configuration based on inputs
 */
function buildRequestConfig(inputs) {
    const hasComment = inputs.comment.trim().length > 0;
    const hasTemplate = inputs.template.trim().length > 0;
    // Validate mode selection
    validateModeSelection(hasComment, hasTemplate);
    if (hasTemplate) {
        // Template mode
        const parsedData = validateTemplateInput(inputs.template, inputs.templateData);
        const requestBody = {
            prNumber: inputs.prNumber,
            template: inputs.template,
            data: parsedData
        };
        if (inputs.stickyId) {
            requestBody.stickyId = inputs.stickyId;
        }
        core.info(`📋 Using template mode: ${inputs.template}`);
        if (inputs.stickyId) {
            core.info(`🔖 Sticky ID: ${inputs.stickyId} (will update existing comment if found)`);
        }
        return {
            endpoint: `${inputs.apiUrl}/comment/template`,
            requestBody,
            mode: 'template'
        };
    }
    else {
        // Simple comment mode
        core.info(`💬 Using simple comment mode`);
        return {
            endpoint: `${inputs.apiUrl}/comment`,
            requestBody: {
                comment: inputs.comment,
                prNumber: inputs.prNumber
            },
            mode: 'simple'
        };
    }
}
