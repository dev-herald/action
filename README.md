# API Call Action

A GitHub Action that calls an API endpoint with API key authentication and custom request body.

## Features

- 🔐 API key authentication via Bearer token
- 📦 Custom request body support (JSON)
- 🔧 Configurable HTTP method (GET, POST, PUT, DELETE, etc.)
- 📝 Additional custom headers support
- ✅ Response and status code outputs

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `api-key` | API key for authentication | Yes | - |
| `endpoint` | The API endpoint URL to call | Yes | - |
| `body` | JSON string or object to send in the request body | No | `{}` |
| `method` | HTTP method to use | No | `POST` |
| `headers` | Additional headers as JSON string | No | `{}` |

## Outputs

| Output | Description |
|--------|-------------|
| `response` | The response body from the API call |
| `status-code` | The HTTP status code from the response |

## Usage

### Basic Example

```yaml
name: Call API
on: [push]

jobs:
  call-api:
    runs-on: ubuntu-latest
    steps:
      - name: Call API endpoint
        uses: ./action
        with:
          api-key: ${{ secrets.API_KEY }}
          endpoint: 'https://api.example.com/webhook'
          body: '{"message": "Hello from GitHub Actions"}'
```

### With Custom Headers

```yaml
- name: Call API with custom headers
  uses: ./action
  with:
    api-key: ${{ secrets.API_KEY }}
    endpoint: 'https://api.example.com/webhook'
    method: 'POST'
    body: '{"event": "deployment", "status": "success"}'
    headers: '{"X-Custom-Header": "value", "X-Request-ID": "12345"}'
```

### GET Request Example

```yaml
- name: GET request
  uses: ./action
  with:
    api-key: ${{ secrets.API_KEY }}
    endpoint: 'https://api.example.com/data'
    method: 'GET'
```

### Using Response Output

```yaml
- name: Call API and use response
  id: api-call
  uses: ./action
  with:
    api-key: ${{ secrets.API_KEY }}
    endpoint: 'https://api.example.com/webhook'
    body: '{"message": "test"}'

- name: Display response
  run: |
    echo "Status: ${{ steps.api-call.outputs.status-code }}"
    echo "Response: ${{ steps.api-call.outputs.response }}"
```

## Development

### Build

```bash
npm install
npm run build
```

### Package for Distribution

```bash
npm run package
```

This will create a `dist/` directory with the compiled action ready for use.

## License

MIT

