#!/usr/bin/env node
// PostCompact / SessionEnd: grava uma nota automática em .claude/sessoes/ para nada se perder.
// Uso: node autosalvar.js compact|fim
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const MIN_PEDIDOS = 3;

function textoDoUsuario(e) {
  if (e.type !== 'user' || e.isSidechain || e.isMeta) return null;
  const c = e.message && e.message.content;
  let t = '';
  if (typeof c === 'string') t = c;
  else if (Array.isArray(c)) {
    if (c.some(b => b.type === 'tool_result')) return null;
    t = c.filter(b => b.type === 'text').map(b => b.text).join(' ');
  }
  t = t.trim();
  // Comandos de barra, avisos de sistema e saídas de hook vêm marcados com tags.
  if (!t || t.startsWith('<') || t.startsWith('[gestor-tokens]')) return null;
  return t.replace(/\s+/g, ' ');
}

function arquivosEditados(entradas, raiz) {
  const vistos = new Set();
  for (const e of entradas) {
    if (e.type !== 'assistant' || e.isSidechain) continue;
    const c = e.message && e.message.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b.type !== 'tool_use' || !/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(b.name)) continue;
      const f = b.input && (b.input.file_path || b.input.notebook_path);
      if (!f) continue;
      const rel = path.relative(raiz, f);
      vistos.add(rel.startsWith('..') ? f : rel.split(path.sep).join('/'));
    }
  }
  return [...vistos];
}

// Já existe nota (manual ou automática) escrita depois que esta sessão começou?
function jaSalvouNestaSessao(dirSessoes, inicioMs) {
  if (!fs.existsSync(dirSessoes)) return false;
  return fs.readdirSync(dirSessoes)
    .filter(f => f.endsWith('.md') && f !== 'ULTIMA.md')
    .some(f => fs.statSync(path.join(dirSessoes, f)).mtimeMs > inicioMs);
}

function main() {
  const modo = process.argv[2] || 'fim';
  const entrada = L.lerStdin();
  const raiz = L.raizDoProjeto(entrada.cwd);
  if (!raiz) return; // fora de projeto (ex.: pasta pessoal): não cria nada

  const entradas = L.lerJsonl(entrada.transcript_path);
  const pedidos = entradas.map(textoDoUsuario).filter(Boolean);
  const editados = arquivosEditados(entradas, raiz);
  const dirSessoes = L.pastaSessoes(raiz);

  if (modo === 'fim') {
    if (pedidos.length < MIN_PEDIDOS && editados.length === 0) return; // sessão curta demais
    const primeiro = entradas.find(e => e.timestamp);
    const inicioMs = primeiro ? Date.parse(primeiro.timestamp) : Date.now();
    if (jaSalvouNestaSessao(dirSessoes, inicioMs)) return; // o usuário já salvou
  }

  const principais = entradas.filter(e => !e.isSidechain).reverse();
  const comBranch = principais.find(e => e.gitBranch);
  const branch = (comBranch && comBranch.gitBranch) || 'sem git';
  const modelo = L.usoDoContexto(entradas).modelo || '?';
  const anterior = L.ultimaNota(raiz);
  const c = L.carimbo();
  const motivo = modo === 'compact' ? `compactação (${entrada.trigger || '?'})` : `fim da sessão (${entrada.reason || '?'})`;
  const projeto = path.basename(raiz);

  const linhas = [
    `# ${projeto} · nota automática`,
    `Data: ${c.data} ${c.hora} · Modelo: ${modelo} · Branch: ${branch} · Motivo: ${motivo}`,
    '',
    '> Gerada pelo hook do gestor-tokens. Para uma nota completa (decisões, pendências, próximo passo),',
    '> rode `/gestor-tokens:salvar` antes de compactar ou encerrar.',
    '',
  ];
  if (entrada.compact_summary) {
    linhas.push('## Resumo da compactação', '', String(entrada.compact_summary).slice(0, 8000).trim(), '');
  }
  if (pedidos.length) {
    linhas.push('## Últimos pedidos', '');
    for (const p of pedidos.slice(-6)) linhas.push(`- ${p.length > 240 ? p.slice(0, 237) + '...' : p}`);
    linhas.push('');
  }
  if (editados.length) {
    linhas.push('## Arquivos editados', '');
    for (const f of editados.slice(0, 40)) linhas.push(`- \`${f}\``);
    linhas.push('');
  }
  if (anterior) {
    linhas.push(`Nota anterior: \`${path.relative(raiz, anterior).split(path.sep).join('/')}\``, '');
  }
  if (entrada.session_id) linhas.push(`Sessão: \`${entrada.session_id}\` (retome com \`claude -r ${entrada.session_id}\`)`, '');

  fs.mkdirSync(dirSessoes, { recursive: true });
  const nome = `${c.arquivo}-auto-${modo}.md`;
  fs.writeFileSync(path.join(dirSessoes, nome), linhas.join('\n'));
  fs.writeFileSync(path.join(dirSessoes, 'ULTIMA.md'), `@.claude/sessoes/${nome}\n`);
}

try { main(); } catch { /* hook nunca deve travar a conversa */ }
