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
exports.makeHttpRequest = makeHttpRequest;
exports.buildHeaders = buildHeaders;
const https = __importStar(require("https"));
/**
 * Makes an HTTPS request with the given parameters
 * @throws {Error} If the URL is not HTTPS (for security)
 */
async function makeHttpRequest(url, method, headers, body) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        // Enforce HTTPS for security - API keys must be transmitted securely
        if (parsedUrl.protocol !== 'https:') {
            reject(new Error(`Only HTTPS URLs are allowed for security reasons. Got: ${parsedUrl.protocol}`));
            return;
        }
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(JSON.stringify(body))
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode || 0,
                    data: data
                });
            });
        });
        req.on('error', (error) => {
            reject(new Error(`Network error: ${error.message}`));
        });
        req.write(JSON.stringify(body));
        req.end();
    });
}
/**
 * Builds headers for the API request
 */
function buildHeaders(apiKey) {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Dev-Herald-GitHub-Action/1.0'
    };
}
