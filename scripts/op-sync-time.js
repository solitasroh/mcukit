#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getConfig() {
  let url = process.env.OPENPROJECT_URL || process.env.openproject_url;
  let apiKey = process.env.OPENPROJECT_API_KEY || process.env.openproject_api_key;
  
  // Attempt to parse local .env file
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('#')) continue;
      if (line.includes('OPENPROJECT_URL=')) url = line.split('=')[1].trim();
      if (line.includes('OPENPROJECT_API_KEY=')) apiKey = line.split('=')[1].trim();
    }
  }
  
  if (url && url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  return { url, apiKey };
}

async function main() {
  const { url, apiKey } = getConfig();
  if (!url || !apiKey) {
    console.warn('⚠️ [Rkit OP-Sync] OPENPROJECT_URL or OPENPROJECT_API_KEY not found in env. Time sync is disabled.');
    process.exit(0);
  }

  // 1. Get the last commit message
  let commitMsg = '';
  try {
    commitMsg = execSync('git log -1 --pretty=%B', { stdio: 'pipe' }).toString().trim();
  } catch (err) {
    console.error('❌ [Rkit OP-Sync] Could not read git log.');
    process.exit(0);
  }

  // 2. Extract OP IDs and #time
  // It could have multiple IDs like "[OP#123] [OP#124] fix module #time 2h"
  const opTagRegex = /\\[OP#(\\d+)\\]/gi;
  let opIds = [];
  let match;
  while ((match = opTagRegex.exec(commitMsg)) !== null) {
    opIds.push(match[1]);
  }
  
  if (opIds.length === 0) {
    // No OP tags found in commit. Silently skip time tracking.
    process.exit(0);
  }

  // Attempt to extract #time Xh (e.g. #time 2h, #time 1.5h)
  const timeRegex = /#time\\s+([\\d\\.]+)[hH]?/;
  const timeMatch = commitMsg.match(timeRegex);
  if (!timeMatch) {
    console.log(`ℹ️ [Rkit OP-Sync] OP ticket(s) found but no '#time Xh' syntax. Skipping time tracking.`);
    process.exit(0);
  }

  const hoursLogged = parseFloat(timeMatch[1]);
  if (isNaN(hoursLogged) || hoursLogged <= 0) {
    console.warn('⚠️ [Rkit OP-Sync] Invalid time format parsed. Skipping.');
    process.exit(0);
  }

  // Split time evenly among OP tags if multiple are present
  const hoursPerTicket = (hoursLogged / opIds.length).toFixed(2);
  const isoDuration = `PT${hoursPerTicket}H`;
  const spentOn = new Date().toISOString().split('T')[0];

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + Buffer.from(`apikey:${apiKey}`).toString('base64')
  };

  try {
    // 3. Fetch Time Entry Activities to satisfy OP validation constraint
    const activitiesRes = await fetch(`${url}/api/v3/time_entries/activities`, { headers });
    if (!activitiesRes.ok) {
      throw new Error(`Failed to fetch activities. HTTP ${activitiesRes.status}`);
    }
    const activitiesBody = await activitiesRes.json();
    const activities = activitiesBody._embedded?.elements;
    
    if (!activities || activities.length === 0) {
      throw new Error('No Time Entry Activities configured on the OpenProject server!');
    }
    
    const defaultActivityId = activities[0].id; // Pick first available domain activity

    // 4. Record time for each extracted task
    console.log(`⏳ [Rkit OP-Sync] Synchronizing ${hoursLogged}h to OpenProject...`);
    for (const opId of opIds) {
      const payload = {
        workPackage: { href: `/api/v3/work_packages/${opId}` },
        hours: isoDuration,
        comment: { raw: commitMsg.split('#time')[0].trim() }, // Don't upload the #time part to the comment
        spentOn: spentOn,
        activity: { href: `/api/v3/time_entries/activities/${defaultActivityId}` }
      };

      const entryRes = await fetch(`${url}/api/v3/time_entries`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!entryRes.ok) {
        let errDesc = entryRes.statusText;
        try {
           const errBody = await entryRes.json();
           errDesc = errBody._type === 'Error' ? errBody.message : JSON.stringify(errBody);
        } catch(e) {}
        console.error(`❌ [Rkit OP-Sync] Failed to log time for OP#${opId}: ${errDesc}`);
      } else {
        console.log(`✅ [Rkit OP-Sync] Logged ${hoursPerTicket}h to OP#${opId}`);
      }
    }
  } catch (err) {
    console.error('❌ [Rkit OP-Sync] Error syncing time to OpenProject:', err.message);
  }
}

main();
