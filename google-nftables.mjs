#!/usr/bin/node

import {writeFileSync, readFileSync, existsSync} from 'fs';
import {execSync} from 'child_process';
const {excludeCidr} = await import(execSync("npm root -g").toString().trim() + '/cidr-tools/dist/index.js');
//const excludeCidr = (await import(execSync("npm root -g").toString().trim() + '/fast-cidr-tools/dist/index.cjs')).exclude;

const GOOGLE_IPRANGES_URL = 'https://www.gstatic.com/ipranges/goog.json';
const GCLOUD_IPRANGES_URL = 'https://www.gstatic.com/ipranges/cloud.json';
const IPV4 = true;
const IPV6 = true;
const RULES_FILE = '/etc/nftables.d/99google.nft';
const CHAIN = 'input';
const IPV4_FAMILY = 'inet';
const IPV6_FAMILY = 'inet';
const TABLE = 'filter';
const PORT = 9999;
const POST_COMMAND = 'rc-service nftables reload';

async function getIpRangesFromServer(url) {
        const response = await fetch(url);
        const json = await response.json();
        const ranges = {syncToken: json.syncToken, ipv4: [], ipv6: []};
        json.prefixes.forEach(function(prefix) {
                if (IPV4 && ('ipv4Prefix' in prefix)) ranges.ipv4.push(prefix.ipv4Prefix);
                if (IPV6 && ('ipv6Prefix' in prefix)) ranges.ipv6.push(prefix.ipv6Prefix);
        });
        return ranges;
}

function writeRule(nft, family, saddr) {
        nft.push('add rule ' + family + ' ' + TABLE + ' ' + CHAIN + ' tcp dport ' + PORT + ' ' + saddr + ' accept comment "Google servers allowed"');
}

function writeIPv4Rule(nft, range) {
        writeRule(nft, IPV4_FAMILY, 'ip saddr ' + range);
}

function writeIPv6Rule(nft, range) {
        writeRule(nft, IPV6_FAMILY, 'ip6 saddr ' + range);
}

async function main() {
        if (!(IPV4 || IPV6)) return;

        const google_ipranges = await getIpRangesFromServer(GOOGLE_IPRANGES_URL);
        const gcloud_ipranges = await getIpRangesFromServer(GCLOUD_IPRANGES_URL);

        const syncHeader = '# syncToken: ' + google_ipranges.syncToken + '-' + gcloud_ipranges.syncToken;

        if (existsSync(RULES_FILE)) {
                if (readFileSync(RULES_FILE).includes(syncHeader)) return;
        }
        
        const nft = [];
        nft.push('#!/usr/sbin/nft -f');
        nft.push(syncHeader);
        nft.push('');

        if (IPV4) {
                const ipranges_ipv4 = excludeCidr(google_ipranges.ipv4, gcloud_ipranges.ipv4);
                ipranges_ipv4.forEach(function(range) {
                        writeIPv4Rule(nft, range); 
                });
        }

        if (IPV6) {
                const ipranges_ipv6 = excludeCidr(google_ipranges.ipv6, gcloud_ipranges.ipv6);
                ipranges_ipv6.forEach(function(range) {
                        writeIPv6Rule(nft, range);
                });
        }

        writeFileSync(RULES_FILE, nft.join('\n'));
        execSync(POST_COMMAND);
}

await main();
