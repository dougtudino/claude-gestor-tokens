#!/usr/bin/env node
// Lê as transcrições de ~/.claude/projects sem gastar tokens e resume as sessões recentes:
// projeto, contexto, modelo, se tem nota. Com --gravar, grava nota das sessões pesadas e paradas.
// Uso: node relatorio-sessoes.js [--dias 3] [--gravar] [--json]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const L = require('./lib');

const args = process.argv.slice(2);
const opt = (nome, padrao) => {
  const i = args.indexOf(nome);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
};
const DIAS = parseFloat(opt('--dias', '3'));
const GRAVAR = args.includes('--gravar');
const JSON_SAIDA = args.includes('--json');
const PASTA = opt('--pasta', path.join(os.homedir(), '.claude', 'projects'));
const PESADA_TOKENS = parseInt(process.env.GESTOR_PESADA_TOKENS || '150000', 10);
const PARADA_MS = 2 * 3600 * 1000; // só mexe em sessão parada há 2h+ (não atrapalha quem está trabalhando)

function transcricoesRecentes() {
  const desde = Date.now() - DIAS * 86400000;
  const out = [];
  if (!fs.existsSync(PASTA)) return out;
  for (const d of fs.readdirSync(PASTA)) {
    const dir = path.join(PASTA, d);
    let itens;
    try { itens = fs.readdirSync(dir); } catch { continue; }
    for (const f of itens) {
      if (!f.endsWith('.jsonl')) continue;
      const arq = path.join(dir, f);
      const mtime = fs.statSync(arq).mtimeMs;
      if (mtime >= desde) out.push({ arq, mtime, sessionId: f.replace(/\.jsonl$/, '') });
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

function analisar(t) {
  const entradas = L.lerJsonl(t.arq);
  const comCwd = entradas.find(e => e.cwd);
  const cwd = comCwd ? comCwd.cwd : '';
  const raiz = cwd ? L.raizDoProjeto(cwd) : null;
  const { tokens, modelo } = L.usoDoContexto(entradas);
  const limite = L.limiteDeCompactacao(modelo, cwd);
  const pedidos = entradas.map(L.textoDoUsuario).filter(Boolean);
  const titulo = (entradas.filter(e => e.type === 'custom-title' || e.type === 'summary').pop() || {});
  const r = {
    sessionId: t.sessionId,
    projeto: raiz ? path.basename(raiz) : (cwd ? path.basename(cwd) + ' (sem projeto)' : '?'),
    cwd,
    raiz,
    titulo: titulo.customTitle || titulo.summary || '',
    ultimaAtividade: new Date(t.mtime).toISOString(),
    paradaHa: Math.round((Date.now() - t.mtime) / 60000),
    tokens,
    limite,
    pct: tokens ? Math.round((tokens / limite) * 100) : 0,
    modelo,
    pedidos: pedidos.length,
    ultimoPedido: (pedidos[pedidos.length - 1] || '').slice(0, 120),
    temNota: raiz ? L.notaDepoisDe(raiz, t.mtime - 30 * 60000) : false,
    notaGravada: null,
  };
  const pesada = tokens >= PESADA_TOKENS;
  const parada = Date.now() - t.mtime >= PARADA_MS;
  if (GRAVAR && raiz && pesada && parada && !r.temNota && pedidos.length >= 3) {
    const n = L.escreverNotaAutomatica({
      entradas, raiz, sufixo: 'supervisor', motivo: 'supervisor (sessão pesada e parada)', sessionId: t.sessionId,
    });
    r.notaGravada = path.relative(raiz, n.arquivo).split(path.sep).join('/');
    r.temNota = true;
  }
  return r;
}

function horas(min) {
  if (min < 60) return `${min}min`;
  if (min < 1440) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}

function main() {
  const sessoes = transcricoesRecentes().map(analisar).filter(s => s.pedidos > 0);
  if (JSON_SAIDA) {
    process.stdout.write(JSON.stringify(sessoes, null, 1));
    return;
  }
  const linhas = [`SESSÕES COM ATIVIDADE NOS ÚLTIMOS ${DIAS} DIAS: ${sessoes.length}`, ''];
  linhas.push('projeto | título | id | parada há | contexto (% do ponto de compactação) | modelo | pedidos | nota | último pedido');
  for (const s of sessoes) {
    const ctx = s.tokens ? `${L.fmtTokens(s.tokens)} (${s.pct}%)` : '-';
    const nota = s.notaGravada ? `GRAVADA ${s.notaGravada}` : s.temNota ? 'ok' : s.raiz ? 'sem' : '-';
    linhas.push([
      s.projeto, s.titulo || '(sem título)', s.sessionId.slice(0, 8), horas(s.paradaHa), ctx,
      (s.modelo || '?').replace('claude-', ''), s.pedidos, nota, s.ultimoPedido,
    ].join(' | '));
  }
  const pesadas = sessoes.filter(s => s.tokens >= PESADA_TOKENS);
  const gravadas = sessoes.filter(s => s.notaGravada);
  linhas.push('', `Pesadas (≥ ${L.fmtTokens(PESADA_TOKENS)}): ${pesadas.length} · Notas gravadas agora: ${gravadas.length}`);
  process.stdout.write(linhas.join('\n') + '\n');
}

main();
