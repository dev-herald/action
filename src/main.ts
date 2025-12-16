import * as core from '@actions/core';
import * as https from 'https';
import * as http from 'http';

// TypeScript interfaces based on OpenAPI spec
interface SimpleCommentRequest {
  comment: string;
  prNumber: number;
}

interface TemplateCommentRequest {
  prNumber: number;
  template: 'DEPLOYMENT' | 'TEST_RESULTS' | 'MIGRATION' | 'CUSTOM_TABLE';
  data: any;
  stickyId?: string;
}

interface SimpleCommentResponse {
  success: boolean;
  message: string;
  projectId: string;
  apiKeyId: string;
  commentId: string;
  prNumber: number;
  repository: string;
  githubCommentId: string;
  githubCommentUrl: string;
  commentLength: number;
}

interface TemplateCommentResponse {
  data: {
    message: string;
    commentId: string;
    status: string;
  };
}

interface ErrorResponse {
  error?: string;
  errors?: Array<{
    message: string;
    code?: string;
    field?: string;
    details?: any;
  }>;
  details?: any;
  commentId?: string;
}

async function run(): Promise<void> {
  try {
    // Get required inputs
    const apiKey = core.getInput('api-key', { required: true });
    const prNumberInput = core.getInput('pr-number', { required: true });
    
    // Get mode-switching inputs
    const comment = core.getInput('comment', { required: false });
    const template = core.getInput('template', { required: false });
    const templateData = core.getInput('template-data', { required: false });
    const stickyId = core.getInput('sticky-id', { required: false });
    
    // Get optional inputs
    const apiUrl = core.getInput('api-url', { required: false }) || 'https://api.devherald.com/api/v1/github';

    // Validate PR number
    const prNumber = parseInt(prNumberInput, 10);
    if (isNaN(prNumber) || prNumber <= 0) {
      core.setFailed(`Invalid pr-number: must be a positive integer, got "${prNumberInput}"`);
      return;
    }

    // Validate mode selection
    const hasComment = comment.trim().length > 0;
    const hasTemplate = template.trim().length > 0;

    if (!hasComment && !hasTemplate) {
      core.setFailed('Must provide either "comment" (for simple comments) or "template" (for template comments)');
      return;
    }

    if (hasComment && hasTemplate) {
      core.setFailed('Cannot provide both "comment" and "template" - choose one mode');
      return;
    }

    // Determine endpoint and build request
    let endpoint: string;
    let requestBody: SimpleCommentRequest | TemplateCommentRequest;

    if (hasTemplate) {
      // Template mode
      const validTemplates = ['DEPLOYMENT', 'TEST_RESULTS', 'MIGRATION', 'CUSTOM_TABLE'];
      if (!validTemplates.includes(template)) {
        core.setFailed(`Invalid template: must be one of ${validTemplates.join(', ')}, got "${template}"`);
        return;
      }

      if (!templateData || templateData.trim().length === 0) {
        core.setFailed('template-data is required when using template mode');
        return;
      }

      // Parse template data
      let parsedData: any;
      try {
        parsedData = JSON.parse(templateData);
      } catch (error) {
        core.setFailed(`Invalid JSON in template-data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return;
      }

      endpoint = `${apiUrl}/comment/template`;
      requestBody = {
        prNumber,
        template: template as 'DEPLOYMENT' | 'TEST_RESULTS' | 'MIGRATION' | 'CUSTOM_TABLE',
        data: parsedData,
        ...(stickyId && { stickyId })
      };

      core.info(`📋 Using template mode: ${template}`);
      if (stickyId) {
        core.info(`🔖 Sticky ID: ${stickyId} (will update existing comment if found)`);
      }
    } else {
      // Simple comment mode
      endpoint = `${apiUrl}/comment`;
      requestBody = {
        comment,
        prNumber
      };

      core.info(`💬 Using simple comment mode`);
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'Dev-Herald-GitHub-Action/1.0'
    };

    core.info(`🚀 Posting to PR #${prNumber}`);
    core.info(`📡 Endpoint: ${endpoint}`);

    // Make the API call
    const response = await makeHttpRequest(endpoint, 'POST', headers, requestBody);

    // Parse response
    let responseData: any;
    try {
      responseData = JSON.parse(response.data);
    } catch (error) {
      core.warning('Could not parse response as JSON');
      responseData = { raw: response.data };
    }

    // Set full response output
    core.setOutput('response', JSON.stringify(responseData));

    // Handle response based on status code
    if (response.statusCode >= 200 && response.statusCode < 300) {
      // Success
      core.info(`✅ Success! Status code: ${response.statusCode}`);

      if (hasTemplate) {
        // Template response (202)
        const templateResponse = responseData as TemplateCommentResponse;
        core.setOutput('comment-id', templateResponse.data.commentId);
        core.setOutput('status', templateResponse.data.status);
        core.info(`📝 Comment ID: ${templateResponse.data.commentId}`);
        core.info(`📊 Status: ${templateResponse.data.status}`);
        core.info(`💡 ${templateResponse.data.message}`);
      } else {
        // Simple comment response (201)
        const simpleResponse = responseData as SimpleCommentResponse;
        core.setOutput('comment-id', simpleResponse.commentId);
        core.setOutput('github-comment-id', simpleResponse.githubCommentId);
        core.setOutput('github-comment-url', simpleResponse.githubCommentUrl);
        core.setOutput('status', 'posted');
        
        core.info(`📝 Comment ID: ${simpleResponse.commentId}`);
        core.info(`🔗 GitHub Comment URL: ${simpleResponse.githubCommentUrl}`);
        core.info(`📦 Repository: ${simpleResponse.repository}`);
      }
    } else {
      // Error response
      const errorResponse = responseData as ErrorResponse;
      let errorMessage = `API call failed with status code ${response.statusCode}`;

      if (errorResponse.error) {
        errorMessage += `\n❌ Error: ${errorResponse.error}`;
      }

      if (errorResponse.errors && Array.isArray(errorResponse.errors)) {
        errorMessage += '\n📋 Validation errors:';
        errorResponse.errors.forEach((err, index) => {
          errorMessage += `\n  ${index + 1}. ${err.message}`;
          if (err.field) {
            errorMessage += ` (field: ${err.field})`;
          }
          if (err.code) {
            errorMessage += ` [${err.code}]`;
          }
        });
      } else if (errorResponse.details) {
        errorMessage += `\n📋 Details: ${typeof errorResponse.details === 'string' ? errorResponse.details : JSON.stringify(errorResponse.details)}`;
      }

      core.setFailed(errorMessage);
    }

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`❌ ${error.message}`);
    } else {
      core.setFailed('❌ Unknown error occurred');
    }
  }
}

async function makeHttpRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: any
): Promise<{ statusCode: number; data: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(JSON.stringify(body))
      }
    };

    const req = client.request(options, (res) => {
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

run();
