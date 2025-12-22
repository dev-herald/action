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
exports.parseResponse = parseResponse;
exports.handleTemplateSuccess = handleTemplateSuccess;
exports.handleSimpleSuccess = handleSimpleSuccess;
exports.handleErrorResponse = handleErrorResponse;
exports.processResponse = processResponse;
const core = __importStar(require("@actions/core"));
/**
 * Parses the HTTP response data as JSON
 */
function parseResponse(response) {
    try {
        return JSON.parse(response.data);
    }
    catch (error) {
        core.warning('Could not parse response as JSON');
        return { raw: response.data };
    }
}
/**
 * Handles a successful template comment response
 */
function handleTemplateSuccess(responseData) {
    core.setOutput('comment-id', responseData.data.commentId);
    core.setOutput('status', responseData.data.status);
    core.info(`📝 Comment ID: ${responseData.data.commentId}`);
    core.info(`📊 Status: ${responseData.data.status}`);
    core.info(`💡 ${responseData.data.message}`);
}
/**
 * Handles a successful simple comment response
 */
function handleSimpleSuccess(responseData) {
    core.setOutput('comment-id', responseData.commentId);
    core.setOutput('github-comment-id', responseData.githubCommentId);
    core.setOutput('github-comment-url', responseData.githubCommentUrl);
    core.setOutput('status', 'posted');
    core.info(`📝 Comment ID: ${responseData.commentId}`);
    core.info(`🔗 GitHub Comment URL: ${responseData.githubCommentUrl}`);
    core.info(`📦 Repository: ${responseData.repository}`);
}
/**
 * Handles an error response from the API
 */
function handleErrorResponse(statusCode, responseData) {
    let errorMessage = `API call failed with status code ${statusCode}`;
    if (responseData.error) {
        errorMessage += `\n❌ Error: ${responseData.error}`;
    }
    if (responseData.errors && Array.isArray(responseData.errors)) {
        errorMessage += '\n📋 Validation errors:';
        responseData.errors.forEach((err, index) => {
            errorMessage += `\n  ${index + 1}. ${err.message}`;
            if (err.field) {
                errorMessage += ` (field: ${err.field})`;
            }
            if (err.code) {
                errorMessage += ` [${err.code}]`;
            }
        });
    }
    else if (responseData.details) {
        errorMessage += `\n📋 Details: ${typeof responseData.details === 'string' ? responseData.details : JSON.stringify(responseData.details)}`;
    }
    core.setFailed(errorMessage);
}
/**
 * Processes the API response and sets appropriate outputs
 */
function processResponse(response, mode) {
    const responseData = parseResponse(response);
    // Set full response output
    core.setOutput('response', JSON.stringify(responseData));
    // Handle response based on status code
    if (response.statusCode >= 200 && response.statusCode < 300) {
        core.info(`✅ Success! Status code: ${response.statusCode}`);
        if (mode === 'template') {
            handleTemplateSuccess(responseData);
        }
        else {
            handleSimpleSuccess(responseData);
        }
    }
    else {
        handleErrorResponse(response.statusCode, responseData);
    }
}
