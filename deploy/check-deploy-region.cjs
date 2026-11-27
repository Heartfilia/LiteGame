#!/usr/bin/env node
/* 部署地区预检
 *
 * 授权移植内容不得部署在日本。上线前用这个脚本确认目标域名的公网 IP 归属：
 *   node deploy/check-deploy-region.cjs --host game.example.com
 *   node deploy/check-deploy-region.cjs --ip 1.2.3.4
 *
 * 判定为日本时退出码为 1，可直接接入 CI / 部署流水线。
 * 依赖公网 IP 归属查询服务；查询失败按「无法确认」处理（不阻塞，但会醒目提示）。
 */
'use strict';

const dns = require('node:dns').promises;

const args = process.argv.slice(2);
function argValue(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const FORBIDDEN = new Set(['JP']);

async function resolveIp(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;
  const result = await dns.lookup(host, { family: 4 });
  return result.address;
}

async function queryProvider(name, ip) {
  if (name === 'ipwho.is') {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || '查询失败');
    return { country: data.country_code, region: data.region, org: data.connection?.org || data.connection?.isp };
  }
  const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const data = await response.json();
  if (data.error) throw new Error(data.reason || String(data.error));
  return { country: data.country_code || data.country, region: data.region, org: data.org };
}

async function lookupCountry(ip) {
  const errors = [];
  for (const provider of ['ipwho.is', 'ipapi.co']) {
    try {
      const info = await queryProvider(provider, ip);
      if (info && info.country) return info;
      errors.push(provider + '：未返回国家');
    } catch (error) {
      errors.push(provider + '：' + error.message);
    }
  }
  throw new Error(errors.join('；'));
}

async function main() {
  const host = argValue('--host');
  const ipArg = argValue('--ip');
  if (!host && !ipArg) {
    console.error('用法：node deploy/check-deploy-region.cjs --host <域名> | --ip <IP>');
    process.exitCode = 2;
    return;
  }

  let ip;
  try {
    ip = await resolveIp(ipArg || host);
  } catch (error) {
    console.error(`✗ 无法解析 ${host || ipArg}：${error.message}`);
    process.exitCode = 2;
    return;
  }
  console.log(`目标 ${host || ''} 解析到 ${ip}`);

  let info;
  try {
    info = await lookupCountry(ip);
  } catch (error) {
    console.warn(`! ${error.message}，无法确认地区。请人工核对机房所在国家。`);
    return;
  }

  const country = String(info.country || '').toUpperCase();
  console.log(`归属：${country || '未知'}${info.region ? ' · ' + info.region : ''}${info.org ? ' · ' + info.org : ''}`);

  if (FORBIDDEN.has(country)) {
    console.error('✗ 该地址位于日本。授权禁止在日本部署，请更换机房或节点后再上线。');
    process.exitCode = 1;
    return;
  }
  console.log('✓ 不在日本，符合授权范围（仍需遵守作者其余约定）。');
}

main().catch((error) => {
  console.error('预检失败：', error.message);
  process.exitCode = 2;
});