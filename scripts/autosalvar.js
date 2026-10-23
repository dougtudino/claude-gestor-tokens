#!/usr/bin/env node
// PostCompact / SessionEnd: grava uma nota automática em .claude/sessoes/ para nada se perder.
// Uso: node autosalvar.js compact|fim
'use strict';
const L = require('./lib');

const MIN_PEDIDOS = 3;

function main() {
  const modo = process.argv[2] || 'fim';
  const entrada = L.lerStdin();
  const raiz = L.raizDoProjeto(entrada.cwd);
  if (!raiz) return; // fora de projeto (ex.: pasta pessoal): não cria nada

  const entradas = L.lerJsonl(entrada.transcript_path);

  if (modo === 'fim') {
    const pedidos = entradas.map(L.textoDoUsuario).filter(Boolean).length;
    if (pedidos < MIN_PEDIDOS && L.arquivosEditados(entradas, raiz).length === 0) return; // sessão curta demais
    const primeiro = entradas.find(e => e.timestamp);
    const inicioMs = primeiro ? Date.parse(primeiro.timestamp) : Date.now();
    if (L.notaDepoisDe(raiz, inicioMs)) return; // já salvou nesta sessão
  }

  L.escreverNotaAutomatica({
    entradas,
    raiz,
    sufixo: modo,
    motivo: modo === 'compact' ? `compactação (${entrada.trigger || '?'})` : `fim da sessão (${entrada.reason || '?'})`,
    sessionId: entrada.session_id,
    resumo: entrada.compact_summary,
  });
}

try { main(); } catch { /* hook nunca deve travar a conversa */ }
