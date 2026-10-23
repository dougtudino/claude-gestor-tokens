// Funções comuns dos hooks do gestor-tokens. Só Node, sem dependências.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

function lerStdin() {
  try {
    const txt = fs.readFileSync(0, 'utf8');
    return txt.trim() ? JSON.parse(txt) : {};
  } catch {
    return {};
  }
}

function lerJsonl(arquivo) {
  if (!arquivo || !fs.existsSync(arquivo)) return [];
  const linhas = fs.readFileSync(arquivo, 'utf8').split('\n');
  const out = [];
  for (const l of linhas) {
    if (!l.trim()) continue;
    try { out.push(JSON.parse(l)); } catch { /* linha parcial: ignora */ }
  }
  return out;
}

// Contexto ocupado = tudo o que entrou na última chamada da conversa principal.
function usoDoContexto(entradas) {
  for (let i = entradas.length - 1; i >= 0; i--) {
    const e = entradas[i];
    if (e.type !== 'assistant' || e.isSidechain) continue;
    const u = e.message && e.message.usage;
    // Mensagens "<synthetic>" (erros e avisos do próprio Claude Code) vêm com uso zerado.
    if (!u || e.message.model === '<synthetic>') continue;
    const tokens = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) +
      (u.cache_read_input_tokens || 0) + (u.output_tokens || 0);
    if (!tokens) continue;
    return { tokens, modelo: e.message.model || '' };
  }
  return { tokens: 0, modelo: '' };
}

// Janela por modelo. GESTOR_JANELA sobrepõe (ex.: 200000).
function janelaDoModelo(modelo) {
  const env = parseInt(process.env.GESTOR_JANELA || '', 10);
  if (env > 0) return env;
  const m = (modelo || '').toLowerCase();
  if (m.includes('[1m]')) return 1000000;
  if (/(fable|mythos)/.test(m)) return 1000000;
  if (/claude-(opus|sonnet|haiku)-5/.test(m)) return 1000000;
  if (/claude-(opus|sonnet)-4-[678]/.test(m)) return 1000000;
  return 200000;
}

// Raiz do projeto: sobe até achar .git ou .claude; senão, null.
function raizDoProjeto(cwd) {
  let dir = path.resolve(cwd || process.cwd());
  const home = path.resolve(os.homedir());
  while (true) {
    if (dir !== home && (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, '.claude')))) {
      return dir;
    }
    const pai = path.dirname(dir);
    if (pai === dir) return null;
    dir = pai;
  }
}

function pastaSessoes(raiz) {
  return path.join(raiz, '.claude', 'sessoes');
}

// Caminho absoluto da nota apontada por ULTIMA.md (formato "@.claude/sessoes/x.md").
function ultimaNota(raiz) {
  const ponteiro = path.join(pastaSessoes(raiz), 'ULTIMA.md');
  if (!fs.existsSync(ponteiro)) return null;
  const linha = fs.readFileSync(ponteiro, 'utf8').split('\n').find(l => l.trim());
  if (!linha) return null;
  const rel = linha.trim().replace(/^@/, '');
  const abs = path.resolve(raiz, rel);
  return fs.existsSync(abs) ? abs : null;
}

// Estado por sessão (para não repetir avisos).
function arquivoEstado(sessionId) {
  const base = process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'gestor-tokens');
  const dir = path.join(base, 'estado');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${(sessionId || 'sem-id').replace(/[^\w-]/g, '')}.json`);
}

function lerEstado(sessionId) {
  try { return JSON.parse(fs.readFileSync(arquivoEstado(sessionId), 'utf8')); } catch { return {}; }
}

function gravarEstado(sessionId, estado) {
  try { fs.writeFileSync(arquivoEstado(sessionId), JSON.stringify(estado)); } catch { /* opcional */ }
}

function fmtTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}

function carimbo(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return {
    data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
    arquivo: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`,
  };
}

function responder(obj) {
  process.stdout.write(JSON.stringify(obj));
}

module.exports = {
  lerStdin, lerJsonl, usoDoContexto, janelaDoModelo, raizDoProjeto, pastaSessoes,
  ultimaNota, lerEstado, gravarEstado, fmtTokens, carimbo, responder,
};
