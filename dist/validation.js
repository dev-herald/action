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
exports.formatZodError = formatZodError;
exports.getActionInputs = getActionInputs;
exports.validateInputs = validateInputs;
exports.buildRequestConfig = buildRequestConfig;
const core = __importStar(require("@actions/core"));
const zod_1 = require("zod");
// ============================================================================
// Zod Schemas
// ============================================================================
/**
 * Schema for PR number - must be a positive integer
 */
const prNumberSchema = zod_1.z.number().int().positive({
    message: 'PR number must be a positive integer (e.g., 123, not 0 or negative numbers)'
});
/**
 * Schema for API key - non-empty string
 */
const apiKeySchema = zod_1.z.string().min(1, {
    message: 'API key is required and cannot be empty'
});
/**
 * Schema for comment text - non-empty after trimming
 */
const commentSchema = zod_1.z.string().trim().min(1, {
    message: 'Comment text cannot be empty or contain only whitespace'
}).max(65536, {
    message: 'Comment text is too long (maximum 65,536 characters)'
});
/**
 * Schema for sticky ID - optional, but if provided must be non-empty
 */
const stickyIdSchema = zod_1.z.string().trim().min(1, {
    message: 'sticky-id cannot be empty if provided'
}).max(256, {
    message: 'sticky-id is too long (maximum 256 characters)'
}).optional();
/**
 * Valid template types
 */
const templateTypeSchema = zod_1.z.enum(['DEPLOYMENT', 'TEST_RESULTS', 'MIGRATION', 'CUSTOM_TABLE'], {
    message: 'Template must be one of: DEPLOYMENT, TEST_RESULTS, MIGRATION, CUSTOM_TABLE'
});
/**
 * Schema for DEPLOYMENT template data
 */
const deploymentDataSchema = zod_1.z.object({
    environment: zod_1.z.string().min(1, 'Environment is required'),
    version: zod_1.z.string().optional(),
    status: zod_1.z.enum(['success', 'failure', 'pending']).optional(),
    url: zod_1.z.string().url('Deployment URL must be a valid URL').optional(),
    timestamp: zod_1.z.string().optional()
}).passthrough(); // Allow additional fields
/**
 * Schema for TEST_RESULTS template data
 */
const testResultsDataSchema = zod_1.z.object({
    total: zod_1.z.number().int().nonnegative('Total tests must be a non-negative integer'),
    passed: zod_1.z.number().int().nonnegative('Passed tests must be a non-negative integer'),
    failed: zod_1.z.number().int().nonnegative('Failed tests must be a non-negative integer'),
    skipped: zod_1.z.number().int().nonnegative('Skipped tests must be a non-negative integer').optional(),
    duration: zod_1.z.string().optional(),
    details: zod_1.z.array(zod_1.z.any()).optional()
}).passthrough();
/**
 * Schema for MIGRATION template data
 */
const migrationDataSchema = zod_1.z.object({
    migrationName: zod_1.z.string().min(1, 'Migration name is required'),
    status: zod_1.z.enum(['success', 'failure', 'pending']).optional(),
    duration: zod_1.z.string().optional(),
    details: zod_1.z.string().optional()
}).passthrough();
/**
 * Schema for CUSTOM_TABLE template data
 */
const customTableDataSchema = zod_1.z.object({
    title: zod_1.z.string().optional(),
    headers: zod_1.z.array(zod_1.z.string()).min(1, 'At least one table header is required'),
    rows: zod_1.z.array(zod_1.z.array(zod_1.z.string())).min(1, 'At least one table row is required')
}).passthrough();
/**
 * Raw action inputs schema (before processing)
 */
const rawInputsSchema = zod_1.z.object({
    apiKey: apiKeySchema,
    prNumber: prNumberSchema,
    comment: zod_1.z.string(),
    template: zod_1.z.string(),
    templateData: zod_1.z.string(),
    stickyId: zod_1.z.string(),
    apiUrl: zod_1.z.string().url('API URL must be a valid HTTPS URL').startsWith('https://', {
        message: 'API URL must use HTTPS for security'
    })
});
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Formats Zod errors into a human-readable message
 */
function formatZodError(error) {
    const messages = [];
    messages.push('❌ Validation failed:\n');
    const issues = error.issues;
    issues.forEach((err, index) => {
        const fieldPath = err.path.length > 0 ? err.path.join('.') : 'input';
        messages.push(`  ${index + 1}. Field "${fieldPath}": ${err.message}`);
        // Add context for specific error types using type guards and any for complex types
        if (err.code === 'invalid_type') {
            const typeErr = err;
            if (typeErr.expected && typeErr.received) {
                messages.push(`     Expected: ${typeErr.expected}, Received: ${typeErr.received}`);
            }
        }
        else if (err.code === 'invalid_value') {
            const valueErr = err;
            if (valueErr.options && Array.isArray(valueErr.options)) {
                messages.push(`     Allowed values: ${valueErr.options.join(', ')}`);
            }
        }
        else if (err.code === 'too_small') {
            const smallErr = err;
            if (smallErr.minimum !== undefined) {
                if (smallErr.type === 'string') {
                    messages.push(`     Minimum length: ${smallErr.minimum} characters`);
                }
                else if (smallErr.type === 'number') {
                    messages.push(`     Minimum value: ${smallErr.minimum}`);
                }
            }
        }
        else if (err.code === 'too_big') {
            const bigErr = err;
            if (bigErr.maximum !== undefined) {
                if (bigErr.type === 'string') {
                    messages.push(`     Maximum length: ${bigErr.maximum} characters`);
                }
                else if (bigErr.type === 'number') {
                    messages.push(`     Maximum value: ${bigErr.maximum}`);
                }
            }
        }
    });
    messages.push('\n💡 Please check your workflow file and ensure all inputs are correct.');
    return messages.join('\n');
}
/**
 * Validates template-specific data based on template type
 */
function validateTemplateData(template, data) {
    try {
        switch (template) {
            case 'DEPLOYMENT':
                return deploymentDataSchema.parse(data);
            case 'TEST_RESULTS':
                return testResultsDataSchema.parse(data);
            case 'MIGRATION':
                return migrationDataSchema.parse(data);
            case 'CUSTOM_TABLE':
                return customTableDataSchema.parse(data);
            default:
                throw new Error(`Unknown template type: ${template}`);
        }
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw new Error(`Invalid data for ${template} template:\n${formatZodError(error)}`);
        }
        throw error;
    }
}
// ============================================================================
// Public API
// ============================================================================
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
        apiUrl: core.getInput('api-url', { required: false }) || 'https://dev-herald.com/api/v1/github'
    };
}
/**
 * Validates all raw inputs using Zod
 */
function validateInputs(inputs) {
    try {
        rawInputsSchema.parse(inputs);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw new Error(formatZodError(error));
        }
        throw error;
    }
}
/**
 * Builds the request configuration based on inputs with Zod validation
 */
function buildRequestConfig(inputs) {
    const hasComment = inputs.comment.trim().length > 0;
    const hasTemplate = inputs.template.trim().length > 0;
    // Validate mode selection
    if (!hasComment && !hasTemplate) {
        throw new Error('❌ Must provide either "comment" (for simple comments) or "template" (for template comments)\n\n' +
            '💡 Example with comment:\n' +
            '  with:\n' +
            '    comment: "## Build Complete\\n✅ All checks passed!"\n\n' +
            '💡 Example with template:\n' +
            '  with:\n' +
            '    template: "DEPLOYMENT"\n' +
            '    template-data: \'{"environment": "production", "status": "success"}\'');
    }
    if (hasComment && hasTemplate) {
        throw new Error('❌ Cannot provide both "comment" and "template" - choose one mode\n\n' +
            '💡 Either use:\n' +
            '  - "comment" for simple markdown comments\n' +
            '  - "template" + "template-data" for structured templates');
    }
    if (hasTemplate) {
        // Template mode - validate template type
        let validatedTemplate;
        try {
            validatedTemplate = templateTypeSchema.parse(inputs.template);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(formatZodError(error));
            }
            throw error;
        }
        // Parse and validate template data
        if (!inputs.templateData || inputs.templateData.trim().length === 0) {
            throw new Error('❌ template-data is required when using template mode\n\n' +
                `💡 The ${inputs.template} template requires JSON data. Example:\n` +
                '  with:\n' +
                `    template: "${inputs.template}"\n` +
                '    template-data: \'{"key": "value"}\'');
        }
        let parsedData;
        try {
            parsedData = JSON.parse(inputs.templateData);
        }
        catch (error) {
            throw new Error(`❌ Invalid JSON in template-data: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
                '💡 Make sure your JSON is properly formatted:\n' +
                '  - Use single quotes around the JSON string in YAML\n' +
                '  - Escape special characters properly\n' +
                '  - Validate JSON at https://jsonlint.com\n\n' +
                'Example:\n' +
                '  template-data: \'{"environment": "production", "status": "success"}\'');
        }
        // Validate template-specific data structure
        const validatedData = validateTemplateData(validatedTemplate, parsedData);
        const requestBody = {
            prNumber: inputs.prNumber,
            template: validatedTemplate,
            data: validatedData
        };
        // Validate and add sticky ID if provided
        if (inputs.stickyId && inputs.stickyId.trim().length > 0) {
            try {
                const validatedStickyId = stickyIdSchema.parse(inputs.stickyId);
                requestBody.stickyId = validatedStickyId;
            }
            catch (error) {
                if (error instanceof zod_1.z.ZodError) {
                    throw new Error(formatZodError(error));
                }
                throw error;
            }
        }
        core.info(`📋 Using template mode: ${validatedTemplate}`);
        if (requestBody.stickyId) {
            core.info(`🔖 Sticky ID: ${requestBody.stickyId} (will update existing comment if found)`);
        }
        return {
            endpoint: `${inputs.apiUrl}/comment/template`,
            requestBody,
            mode: 'template'
        };
    }
    else {
        // Simple comment mode - validate comment text
        let validatedComment;
        try {
            validatedComment = commentSchema.parse(inputs.comment);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(formatZodError(error));
            }
            throw error;
        }
        core.info(`💬 Using simple comment mode`);
        const requestBody = {
            comment: validatedComment,
            prNumber: inputs.prNumber
        };
        // Validate and add sticky ID if provided
        if (inputs.stickyId && inputs.stickyId.trim().length > 0) {
            try {
                const validatedStickyId = stickyIdSchema.parse(inputs.stickyId);
                requestBody.stickyId = validatedStickyId;
                core.info(`🔖 Sticky ID: ${requestBody.stickyId} (will update existing comment if found)`);
            }
            catch (error) {
                if (error instanceof zod_1.z.ZodError) {
                    throw new Error(formatZodError(error));
                }
                throw error;
            }
        }
        return {
            endpoint: `${inputs.apiUrl}/comment`,
            requestBody,
            mode: 'simple'
        };
    }
}
