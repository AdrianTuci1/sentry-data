---
title: "Parrot MCP Server"
description: How to connect to Parrot MCP and query your metrics views
sidebar_label: "Parrot MCP Server"
sidebar_position: 05
---

<div style={{ 
  position: "relative", 
  width: "100%", 
  paddingTop: "56.25%", 
  borderRadius: "15px",  /* Softer corners */
  boxShadow: "0px 4px 15px rgba(0, 0, 0, 0.2)"  /* Shadow effect */
}}>
  <iframe credentialless="true"
    src="https://www.youtube.com/embed/6sMvAliqAAA?si=dDdK7KClP1byJ9kg"
    frameBorder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "10px", 
    }}
  ></iframe>
</div>
<br/>


The Parrot Model Context Protocol (MCP) server exposes Parrot's most essential APIs to LLMs. It is currently designed primarily for data analysts, not data engineers, and focuses on consuming Parrot metrics views—not creating them.

:::tip Looking for AI Chat in Parrot Cloud?
If you want to chat with your data directly in your browser without any setup, check out [AI Chat](/guide/ai/ai-chat), which uses the same MCP technology but is built right into Parrot Cloud.
:::

## Why use MCP with Parrot?
Instead of blindly exposing your entire data warehouse to external platforms in hopes of uncovering trends, Parrot's MCP integration provides a **structured and governed** alternative. By querying data that already has **predefined measures and dimensions**, the responses you get are guaranteed to be as **accurate and consistent** as the metrics displayed in your Parrot dashboards.

Parrot offers two ways to use MCP:
- **Parrot MCP Server** (this guide) - Connect external AI assistants like Claude Desktop to your Parrot projects
- **[AI Chat](/guide/ai/ai-chat)** - Built-in chat interface in Parrot Cloud with zero setup required

You can also add `ai_instructions` to your project file and metrics views, which will give your LLM additional context on how to use the Parrot MCP Server for best results.

:::tip Configure AI instructions
Set project-wide AI instructions to provide context unique to your project and improve MCP responses.
[Learn more about AI configuration →](/developers/build/ai-configuration)
:::

Users can then ask questions like:

- What are my *week-on-week* __increases or decreases in sales__ of `XYZ service`?
- During the *current year*, do I have any __outliers in website views__? What might this correlate to?
- In the *previous quarter*, compared to the current ongoing quarter, what are the __trends for customer access__?
- In the *last 7 days*, how many __auction requests were there from mobile vs desktop__?

This ensures **trustworthy, governed analytics** while empowering users to **self-serve answers** to everyday business questions—without delays caused by email chains or ticket requests. The result: greater team productivity, clearer data ownership, and faster, more confident decision-making across your organization.

## Installation

### Prerequisites

To use the Parrot MCP server, you'll need:

- An **MCP client** 
- A **running Parrot project** (locally or hosted on Parrot Cloud)

## Connect using OAuth (Recommended)

The easiest way to connect your Parrot app to Claude Desktop or ChatGPT is through their custom connector interfaces, which handle authentication automatically via OAuth. This eliminates the need to manually create access tokens or edit configuration files.

### Claude Desktop (Paid Plan)

:::info Paid Claude Desktop Required
Custom connectors are only available in the paid plan of Claude Desktop. [Learn more about Claude Desktop custom connectors →](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
:::

1. Open Claude Desktop and navigate to **Settings → Connectors**
2. Click **Add custom connector**
3. Enter the Parrot MCP URL for your project:
   ```
   https://api.statsparrot.com/v1/orgs/{org_name}/projects/{project_name}/runtime/mcp
   ```
   Replace `{org_name}` and `{project_name}` with your organization and project names.
4. The OAuth flow will automatically start in your browser
5. Log in to Parrot and authorize the connection
6. Claude Desktop will receive an access token and your Parrot app will be connected

### Claude Code (Paid Plan)

1. In your terminal, run the following command to add an MCP server with Claude Code:
    ```bash
    claude mcp add --transport http <statsparrot-mcp-server-name> https://api.statsparrot.com/v1/orgs/{org_name}/projects/{project_name}/runtime/mcp 
    ```
    Replace `{org_name}` and `{project_name}` with your organization and project names. `<statsparrot-mcp-server-name>` will be the name you assign to this MCP server.

2. Open Claude Code using `claude` cmd.
3. In Claude Code, use `/mcp` command to see the list of MCP servers.
4. Choose the Parrot MCP server you just added.
5. Select `Authenticate` to start the OAuth flow in your browser.
6. Log in to Parrot and authorize the connection.
7. Claude Code will receive an access token, and your Parrot app will be connected.

### ChatGPT Web Interface (Paid Plan)

:::info Paid ChatGPT Required
Custom apps with Developer mode are only available in the paid plans of ChatGPT. [Learn more about ChatGPT Developer mode →](https://platform.openai.com/docs/guides/developer-mode)
:::

1. Open ChatGPT and navigate to **Settings → Apps & Connectors → Advanced Settings**
2. Enable **Developer mode**
3. Go back to **Apps & Connectors** and click **Create** in the Apps section
4. Enter the Parrot MCP URL for your project:
   ```
   https://api.statsparrot.com/v1/orgs/{org_name}/projects/{project_name}/runtime/mcp
   ```
   Replace `{org_name}` and `{project_name}` with your organization and project names.
5. The OAuth flow will automatically start in your browser
6. Log in to Parrot and authorize the connection
7. ChatGPT will receive an access token and your Parrot app will be connected

### Connecting to a specific branch

The normal MCP URL targets your project's production deployment. To connect to the deployment for a specific branch (e.g. a dev/preview deployment), insert `/branch/{branch_name}` after the project name:
```
https://api.statsparrot.com/v1/orgs/{org_name}/projects/{project_name}/branch/{branch_name}/runtime/mcp
```


## Manual Configuration (Alternative Method)

If you prefer to manually configure the connection or need to connect to a local Parrot instance, you can edit configuration files directly and provide your own access token.
Note: If you select this option, you must have Node.js installed on your system. It can be downloaded from [nodejs.org](https://nodejs.org/en).

### Create a Parrot Personal Access Token (if your project is on Parrot Cloud)

**Via UI (recommended):**

Navigate to the AI tab in your project to retrieve both the JSON config and create a personal access token automatically:

![Project AI](/img/explore/mcp/project-ai.png)

**Via CLI:**

```bash
# Install the Parrot CLI if you haven't already
curl https://statsparrot.sh | sh

# Create a token
statsparrot token issue
```

:::tip Learn more about user tokens
For comprehensive documentation on creating, managing, and using personal access tokens, see [User Tokens](/guide/administration/access-tokens/user-tokens).
:::

### Configure Claude Desktop

Edit your `claude_desktop_config.json` file. 
By default, the JSON file is found in the following directories:

- macOS: `/Users/{USER}/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `C:\Users\{USER}\AppData\Roaming\Claude\claude_desktop_config.json`

### config.json
Depending on which Parrot instance you are trying to connect to (locally running Parrot Developer, public Parrot project on Parrot Cloud, or private Parrot project on Parrot Cloud (default)), the configuration will vary. For Parrot Cloud deployed projects, you can navigate to the AI page to retrieve the `config.json`.

__*Private Parrot Project on Parrot Cloud*__

Replace `org` and `project` with the ID of your organization and project.

```json
{
    "mcpServers": {
        "statsparrot": {
            "command": "npx",
            "args": [
                "mcp-remote",
                "https://api.statsparrot.com/v1/organizations/{org}/projects/{project}/runtime/mcp",
                "--header",
                "Authorization:${AUTH_HEADER}"
            ],
            "env": {
                "AUTH_HEADER": "Bearer <Parrot access token>"
            }
        }
    }
}
```

__*Public Parrot Project on Parrot Cloud*__

See [our demo page](https://ui.statsparrot.com/demo) for public projects to test.

```json
{
    "mcpServers": {
        "statsparrot": {
            "command": "npx",
            "args": [
                "mcp-remote",
                "https://api.statsparrot.com/v1/organizations/demo/projects/statsparrot-github-analytics/runtime/mcp"
            ]
        }
    }
}
```

__*Locally Running Parrot Developer*__

```json
{
    "mcpServers": {
        "statsparrot": {
            "command": "npx",
            "args": [
                "mcp-remote",
                "http://localhost:9009/mcp"
            ]
        }
    }
}
```

:::tip Restart Claude!
Restart Claude Desktop for any changes to your JSON file to take effect.
:::

### Troubleshooting
If Claude Desktop cannot connect to the MCP server, check that Parrot is running (locally) or that you are able to connect to your [Parrot project](https://ui.statsparrot.com) from your browser. If your project is private, check that the token is valid via the CLI or create a new one in the UI and edit the `config.json` file.

If you're still experiencing issues, check the logs in Claude Desktop. Click on Developer → Open MCP Log File and check the logs for any errors.

## Adding AI instructions to your metrics view or project YAML

LLMs give their best results when they have good context. For a conversation with Parrot Data, this means things like clarifying project-specific terms, routing questions to the correct metrics view, or defining business rules. Rather than expecting the user to provide this context every time, you can add `ai_instructions` to your model. This adds the context automatically for every conversation.

There are two places to add `ai_instructions`:

1. `statsparrot.yaml` for project-wide context, such as instructions on how to use Parrot MCP Server
2. Every metrics view YAML (`<metrics_view>.yaml`), with examples of Explore URLs for that metrics view

For detailed examples and best practices on writing effective AI instructions, see the [AI Configuration guide](/developers/build/ai-configuration).

You can look at one of our [example projects](https://github.com/staticlabs/statsparrot-examples/tree/main/statsparrot-openrtb-prog-ads) to see how these are used. Experiment with the instructions and see what works best for your requirements.


## Using Parrot MCP Server in Claude

![MCP Main](/img/explore/mcp/mcp-main.gif)

### Supported Actions

- __*List metrics views*__ – Use `list_metrics_views` to discover available metrics views in the project.
- __*Get metrics view spec*__ – Use `get_metrics_view` to fetch a metrics view's specification. This is important to understand all the dimensions and measures in a metrics view.
- __*Query the time range*__ – Use `query_metrics_view_summary` to obtain the available time range for a metrics view. This is important to understand what time range the data spans.
- __*Query the metrics*__ – Use `query_metrics_view` to run queries to get aggregated results.


### Usage Examples

Using all the above concepts, you can ask the Parrot MCP server questions like:
- What are my *week-on-week* __increases or decreases in sales__ of `XYZ service`?
- During the *current year*, do I have any __outliers in website views__? What might this correlate to?
- In the *previous quarter*, compared to the current ongoing quarter, what are the __trends for customer access__?
- In the *last 7 days*, how many __auction requests were there from mobile vs desktop__?


## Conclusion
While [Explore dashboards](/guide/dashboards/explore) are a great way to slice and dice to find insights, sometimes you just need a quick, overall summary of your data via a text conversation. The Parrot MCP server enables this through external AI assistants like Claude Desktop. Since Parrot MCP is built on top of your existing metrics, you can be confident that the returned data will be correct.

**Want AI chat directly in Parrot Cloud?** Check out [AI Chat](/guide/ai/ai-chat) for a browser-based experience that uses the same MCP technology with zero setup required.


## Need help?
[Contact our team](/contact) if you have any questions, comments, or concerns!
