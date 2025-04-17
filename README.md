# Cloudflare Worker for Dynamic DNS Update

## Purpose

This Cloudflare Worker is designed to automatically update the IP address of a specified DNS A record in your Cloudflare zone. It periodically checks the current public IP address associated with a given hostname (e.g., a dynamic DNS service) and compares it to the IP address currently set for your DNS record in Cloudflare. If the IPs do not match, the Worker will update the Cloudflare DNS record to the new IP address.

## Configuration

This project uses `wrangler` for managing and deploying the Cloudflare Worker. The configuration for the Worker is managed through the `wrangler.toml` file. However, this repository includes a `wrangler.toml.template` file to avoid committing sensitive information like API tokens directly to the repository.

**To configure the Worker locally, follow these steps:**

1.  **Create a `wrangler.toml` file:** Copy the contents of `wrangler.toml.template` into a new file named `wrangler.toml` in the root of your project directory.

2.  **Edit `wrangler.toml`:** Open the newly created `wrangler.toml` file and modify the following values according to your setup:

    ```toml
    name = "your-worker-name" # Replace with your desired Worker name
    main = "src/index.js"
    compatibility_date = "2024-04-16" # Or the latest compatibility date

    [vars]
    ZONE_ID = "YOUR_CLOUDFLARE_ZONE_ID" # Replace with your Cloudflare Zone ID
    RECORD_NAME = "your.domain.com" # Replace with the DNS A record name you want to update
    NO_IP_HOSTNAME = "your-ddns-hostname.example.com" # Replace with the hostname you are using for dynamic DNS
    CF_API_TOKEN = "YOUR_CLOUDFLARE_API_TOKEN" # Replace with your Cloudflare API token
    
    [triggers]
    crons = ["*/10 * * * *"] # Adjusted as needed. Use cron.guru. 
    ```

    * **`name`**: Choose a unique name for your Cloudflare Worker.
    * **`ZONE_ID`**: You can find your Zone ID in the Cloudflare dashboard on the "Overview" page of your domain.
    * **`RECORD_NAME`**: This is the subdomain or domain for which you want to update the A record (e.g., `home`, `www`, or your root domain `yourdomain.com`).
    * **`NO_IP_HOSTNAME`**: This is the hostname provided by your dynamic DNS service (e.g., from No-IP, DuckDNS, etc.) that resolves to your current public IP address.
    * **`CF_API_TOKEN`**: You need to create a Cloudflare API token with the following permissions:
        * **Zone:** Read
        * **DNS:** Edit
        You can create a token in the Cloudflare dashboard under "API Tokens".

3.  **Save the `wrangler.toml` file.**

## Deployment

To deploy this Cloudflare Worker to your Cloudflare account, use the following command in your terminal, from the root of your project directory:

```bash
wrangler deploy -c ./wrangler.toml
```

## Prerequisites

* A Cloudflare account with a domain managed under it.
* A dynamic DNS service providing a hostname that resolves to your current public IP address.
* The `wrangler` CLI tool installed and configured for your Cloudflare account. You can find installation instructions in the official Cloudflare Workers documentation.