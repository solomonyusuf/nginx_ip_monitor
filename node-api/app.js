const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const ip = require('ip');
const morgan = require('morgan');

const app = express();
app.use(bodyParser.json());

const RULES_FILE = process.env.RULES_FILE || '/etc/nginx/conf.d/ip-rules.conf';
const LOG_DIR = '/var/log/ip_manager';
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const accessStream = fs.createWriteStream(path.join(LOG_DIR, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessStream }));

const MANAGER_LOG = path.join(LOG_DIR, 'manager.log');

function log(msg){
  fs.appendFileSync(MANAGER_LOG, new Date().toISOString() + ' ' + msg + '\n');
}

// simple token auth
// const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme-token';

// function auth(req,res,next){
//   const t = req.headers.authorization && req.headers.authorization.split(' ')[1];
//   if (!t || t !== ADMIN_TOKEN) return res.status(401).json({ error: 'unauthorized' });
//   next();
// }

// app.use('/api', auth);

// helpers
function readLines(){
  try { return fs.readFileSync(RULES_FILE,'utf8').split(/\r?\n/); }
  catch(e){ return []; }
}

function parseRules(){
  const lines = readLines();
  let mode = 'blacklist';
  const rules = [];
  for (let l of lines){
    l = l.trim(); if (!l) continue;
    if (l.startsWith('MODE=')) { mode = l.split('=')[1].trim(); continue; }
    if (l.startsWith('#')) continue;
    const m = l.match(/(allow|deny)\s+([^\s;]+);/);
    if (m) rules.push({ action:m[1], value:m[2] });
  }
  return { mode, rules };
}

function writeRules(mode, rules){
  const out = [];
  out.push(`MODE=${mode}`);
  out.push('');
  for (const r of rules) out.push(`${r.action} ${r.value};`);
  out.push('');
  fs.writeFileSync(RULES_FILE, out.join('\n'));
  log(`wrote rules mode=${mode} count=${rules.length}`);
}

function parseSitesConfig() {
  const config = fs.readFileSync('/etc/nginx/conf.d/default.conf', 'utf8');
  const matches = [...config.matchAll(/location\s+\/(.*?)\//g)];
  return matches.map(m => m[1]);
}

function addLocationToConfig(name, target) {
  const configPath = '/etc/nginx/conf.d/default.conf';
  let conf = fs.readFileSync(configPath, 'utf8');
  
  const block = `
  location /${name}/ {
      proxy_pass ${target};
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }\n`;
  
  conf += block;
  fs.writeFileSync(configPath, conf, 'utf8');
}

function removeLocationFromConfig(name) {
  const configPath = '/etc/nginx/conf.d/default.conf';
  let conf = fs.readFileSync(configPath, 'utf8');
  const regex = new RegExp(`location\\s+\\/${name}\\/\\s*\\{[^}]*\\}`, 'g');
  conf = conf.replace(regex, '');
  fs.writeFileSync(configPath, conf, 'utf8');
}

function reloadNginx() {
  const { execSync } = require('child_process');
  execSync('nginx -s reload');
}



// endpoints
app.get('/api/rules', (req,res) => res.json(parseRules()));

app.post('/api/block', (req,res) => {
  const { ip: ipv } = req.body; if (!ipv) return res.status(400).json({error:'missing ip'});
  const state = parseRules();
  if (state.rules.find(r=>r.action==='deny' && r.value===ipv)) return res.json({ ok:false, reason:'exists' });
  state.rules.push({ action:'deny', value: ipv });
  writeRules(state.mode, state.rules);
  log(`ADD deny ${ipv} by ${req.ip}`);
  res.json({ ok:true, ip: ipv });
});

app.post('/api/allow', (req,res) => {
  const { ip: ipv } = req.body; if (!ipv) return res.status(400).json({error:'missing ip'});
  const state = parseRules();
  if (state.rules.find(r=>r.action==='allow' && r.value===ipv)) return res.json({ ok:false, reason:'exists' });
  state.rules.push({ action:'allow', value: ipv });
  writeRules(state.mode, state.rules);
  log(`ADD allow ${ipv} by ${req.ip}`);
  res.json({ ok:true, ip: ipv });
});

app.delete('/api/remove', (req,res) => {
  const { ip: ipv } = req.body; if (!ipv) return res.status(400).json({error:'missing ip'});
  const state = parseRules();
  const before = state.rules.length;
  state.rules = state.rules.filter(r=>r.value !== ipv);
  writeRules(state.mode, state.rules);
  log(`REMOVE ${ipv} by ${req.ip}`);
  res.json({ ok: before !== state.rules.length });
});

app.put('/api/edit', (req,res) => {
  const { old, _new, action } = req.body;
  if (!old || !_new || !action) return res.status(400).json({ error: 'old, _new and action required' });
  const state = parseRules();
  let found = false;
  state.rules = state.rules.map(r=>{
    if (r.value === old){ found = true; return { action, value: _new }; }
    return r;
  });
  if (!found) return res.json({ ok:false, reason:'notfound' });
  writeRules(state.mode, state.rules);
  log(`EDIT ${old} -> ${_new} (${action}) by ${req.ip}`);
  res.json({ ok:true });
});

app.post('/api/mode', (req,res) => {
  const { mode } = req.body;
  if (!mode || !['blacklist','whitelist'].includes(mode)) return res.status(400).json({error:'mode must be blacklist or whitelist'});
  const state = parseRules();
  writeRules(mode, state.rules);
  log(`SET MODE ${mode} by ${req.ip}`);
  res.json({ ok:true, mode });
});

app.post('/api/test', (req,res) => {
  const { ip: testIp } = req.body; if (!testIp) return res.status(400).json({error:'missing ip'});
  const state = parseRules();
  // first-match semantics
  for (const r of state.rules){
    if (r.value.includes('/')){
      try {
        if (ip.cidrSubnet(r.value).contains(testIp)) return res.json({ ip: testIp, allowed: r.action === 'allow' });
      } catch(e){}
    } else {
      if (r.value === testIp) return res.json({ ip: testIp, allowed: r.action === 'allow' });
    }
  }
  // default
  const allowed = state.mode === 'whitelist' ? false : true;
  res.json({ ip: testIp, allowed });
});

app.get('/api/sites', (req, res) => {
  const sites = parseSitesConfig(); // read from nginx config file
  res.json({ sites });
});

app.post('/api/sites', (req, res) => {
  const { name, target } = req.body; 
  if (!name || !target) return res.status(400).json({ error: 'Missing name or target' });

  addLocationToConfig(name, target); 
  reloadNginx(); 
  log(`Added site ${name} -> ${target} by ${req.ip}`);

  res.json({ ok: true, name, target });
});

app.delete('/api/sites/:name', (req, res) => {
  const { name } = req.params;
  removeLocationFromConfig(name);
  reloadNginx();
  log(`Removed site ${name} by ${req.ip}`);
  res.json({ ok: true, name });
});

// logs: /api/logs?type=nginx|node&lines=200
app.get('/api/logs', (req, res) => {
  // Get number of lines from query, default 200
  const lines = parseInt(req.query.lines || '200', 10);

  const accessFile = '/var/log/nginx/access.log';
  const errorFile = '/var/log/nginx/error.log';

  try {
    const access = fs.existsSync(accessFile)
      ? fs.readFileSync(accessFile, 'utf8').trim().split(/\r?\n/).slice(-lines)
      : ['Access log not found'];

    const error = fs.existsSync(errorFile)
      ? fs.readFileSync(errorFile, 'utf8').trim().split(/\r?\n/).slice(-lines)
      : ['Error log not found'];

    res.json({ access, error });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = 3000;

app.listen(port, () => {
  log(`Node API started on port ${port}`);
  console.log(`IP Manager running on ${port}`);
});
