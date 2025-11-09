import * as core from '@actions/core';
import * as https from 'https';
import * as http from 'http';

async function run(): Promise<void> {
  try {
    // Get inputs
    const apiKey = core.getInput('api-key', { required: true });
    const endpoint = core.getInput('endpoint', { required: true });
    const bodyInput = core.getInput('body', { required: false }) || '{}';
    const method = core.getInput('method', { required: false }) || 'POST';
    const headersInput = core.getInput('headers', { required: false }) || '{}';

    // Parse body and headers
    let requestBody: any;
    let additionalHeaders: Record<string, string> = {};

    try {
      requestBody = JSON.parse(bodyInput);
    } catch (error) {
      core.setFailed(`Invalid JSON in body input: ${error}`);
      return;
    }

    try {
      additionalHeaders = JSON.parse(headersInput);
    } catch (error) {
      core.setFailed(`Invalid JSON in headers input: ${error}`);
      return;
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...additionalHeaders
    };

    // Parse URL
    const url = new URL(endpoint);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    // Prepare request options
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: headers
    };

    core.info(`Calling ${method} ${endpoint}`);

    // Make the request
    const response = await new Promise<{ statusCode: number; data: string; headers: Record<string, string | string[] | undefined> }>((resolve, reject) => {
      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            data: data,
            headers: res.headers
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      // Write body if it exists and method supports it
      if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && Object.keys(requestBody).length > 0) {
        req.write(JSON.stringify(requestBody));
      }

      req.end();
    });

    // Set outputs
    core.setOutput('response', response.data);
    core.setOutput('status-code', response.statusCode.toString());

    // Log response
    core.info(`Status Code: ${response.statusCode}`);
    core.info(`Response: ${response.data}`);

    // Fail if status code indicates error
    if (response.statusCode && response.statusCode >= 400) {
      core.setFailed(`API call failed with status code ${response.statusCode}`);
    }

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

run();

