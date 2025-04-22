export default {
    /**
     * @param {ScheduledEvent} event
     * @param {Env} env
     * @param {ExecutionContext} ctx
     */
    async scheduled(event, env, ctx) {
        console.log(`trigger fired at ${event.cron}`);
        ctx.waitUntil(handleScheduled(env));
    },
};

async function handleScheduled(env) {

    console.log("handleScheduled")
    const zoneId = env.ZONE_ID;
    const recordName = env.RECORD_NAME;
    const noIpHostname = env.NO_IP_HOSTNAME;
    const apiToken = env.CF_API_TOKEN;
    const recordType = 'A';

    if (!zoneId || !recordName || !noIpHostname || !apiToken) {
        console.error("Error: Missing environment variables / secrets (ZONE_ID, RECORD_NAME, NO_IP_HOSTNAME, CF_API_TOKEN).");
        return;
    }

    try {
        const currentPublicIp = await resolveHostname(noIpHostname, recordType);
        if (!currentPublicIp) {
            console.error(`Couldn't resolver IP for ${noIpHostname}`);
            return;
        }

        console.log(`${noIpHostname}: ${currentPublicIp}`);

        // 2. Obtener la IP actual del registro A en Cloudflare
        const cfApiBase = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
        const headers = {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        };

        // Buscar el registro específico
        const params = new URLSearchParams({
            name: recordName,
            type: recordType
        });
        const listResponse = await fetch(`${cfApiBase}?${params.toString()}`, {
            headers
        });

        if (!listResponse.ok) {
            console.error(`Error getting Cloudflare DNS: ${listResponse.status} ${listResponse.statusText}`);
            const errorBody = await listResponse.text();
            console.error("Cloudflare Error:", errorBody);
            return;
        }

        const listResult = await listResponse.json();

        if (!listResult.success || listResult.result.length === 0) {
            console.error(`Error: Record ${recordType}, ${recordName} (${zoneId}) not found.`);
            console.log("Cloudflare Response:", JSON.stringify(listResult, null, 2));
            return;
        }

        const dnsRecord = listResult.result[0];
        const currentCloudflareIp = dnsRecord.content;
        const recordId = dnsRecord.id;

        console.log(`Actual IP on Cloudflare. ${recordName}: ${currentCloudflareIp}`);

        if (currentPublicIp !== currentCloudflareIp) {
            console.log(`Updating Cloudflare (${recordName} -> ${currentPublicIp})...`);

            const updateData = {
                type: recordType,
                name: recordName,
                content: currentPublicIp,
                ttl: dnsRecord.ttl,
                proxied: dnsRecord.proxied
            };

            const updateResponse = await fetch(`${cfApiBase}/${recordId}`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(updateData)
            });

            if (!updateResponse.ok) {
                console.error(`Error updating Cloudflare DNS: ${updateResponse.status} ${updateResponse.statusText}`);
                const errorBody = await updateResponse.text();
                console.error("Cloudflare Response:", errorBody);
            } else {
                const updateResult = await updateResponse.json();
                if (updateResult.success) {
                    console.log(`DNS ${recordName} updated to ${currentPublicIp}.`);
                } else {
                    console.error("Cloudflare API error:", JSON.stringify(updateResult.errors));
                }
            }
        } else {
            console.log(`IPs (${currentPublicIp}) match. No update required.`);
        }

    } catch (error) {
        console.error("Unexpected error:", error);
        if (error.cause) {
            console.error("Error:", error.cause);
        }
    }
}

/**
 * Resolve hostname using DNS over HTTPS on Cloudflare
 * @param {string} hostname
 * @param {string} type
 * @returns {Promise<string|null>}
 */
async function resolveHostname(hostname, type = 'A') {
    console.log('resolveHostname inputs:', hostname, type);
    const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`;
    console.log('Generated DoH URL:', dohUrl);

    try {
        const response = await fetch(dohUrl, {
            headers: {
                'accept': 'application/dns-json'
            }
        });

        console.log('DoH Response Status:', response.status);

        if (!response.ok) {
            console.error(`DoH Error: ${response.status}`);
            const errorBody = await response.text();
            console.error("DoH Error Body:", errorBody);
            return null;
        }

        const data = await response.json();
        console.log('DoH Response Data:', JSON.stringify(data, null, 2));

        // Status codes: 0=NOERROR, 1=FORMERR, 2=SERVFAIL, 3=NXDOMAIN, etc.
        if (data.Status === 0 && data.Answer && data.Answer.length > 0) {
            for (const answer of data.Answer) {
                // [1:A, 22:AAAA]
                if (answer.type === (type === 'A' ? 1 : 28)) {
                    console.log(`Resolved IP for ${hostname}: ${answer.data}`);
                    return answer.data;
                }
            }
            console.warn(`Records ${type} not found on DoH response ${hostname}`);
            return null;
        } else {
            console.warn(`DoH response not successful or no answer section for ${hostname}. Status: ${data.Status}`);
            console.log("DoH full response (no answer/status != 0):", JSON.stringify(data, null, 2));
            return null;
        }
    } catch (error) {
        console.error(`DoH fetch failed: ${error}`);
        if (error.cause) {
            console.error("DoH fetch error cause:", error.cause);
        }
        return null;
    }
}
