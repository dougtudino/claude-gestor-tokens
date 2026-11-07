#!/usr/bin/env node
// PostCompact / SessionEnd: grava uma nota automática em .claude/sessoes/ para nada se perder.
// Uso: node autosalvar.js compact|fim
'use strict';
const path = require('path');
const L = require('./lib');
const C = require('./central');

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
    if (L.notaDepoisDe(raiz, inicioMs)) return publicar(raiz, entrada, entradas); // já salvou nesta sessão
  }

  L.escreverNotaAutomatica({
    entradas,
    raiz,
    sufixo: modo,
    motivo: modo === 'compact' ? `compactação (${entrada.trigger || '?'})` : `fim da sessão (${entrada.reason || '?'})`,
    sessionId: entrada.session_id,
    resumo: entrada.compact_summary,
  });
  publicar(raiz, entrada, entradas);
}

// Central de comando: a nota vai para a pasta sincronizada e a sessão entra no inventário deste PC.
function publicar(raiz, entrada, entradas) {
  const m = C.maquina();
  if (!m.central) return;
  C.publicarNota(raiz, L.ultimaNota(raiz), m);
  const { tokens, modelo } = L.usoDoContexto(entradas);
  const limite = L.limiteDeCompactacao(modelo, entrada.cwd);
  const titulo = entradas.filter(e => e.type === 'custom-title' || e.type === 'summary').pop() || {};
  C.gravarInventario([C.resumoDaSessao({
    sessionId: entrada.session_id,
    projeto: path.basename(raiz),
    titulo: titulo.customTitle || titulo.summary || '',
    cwd: entrada.cwd,
    ultimaAtividade: new Date().toISOString(),
    tokens,
    pct: tokens ? Math.round((tokens / limite) * 100) : 0,
    modelo,
    pedidos: entradas.map(L.textoDoUsuario).filter(Boolean).length,
    temNota: true,
  }, raiz)], {}, m);
  C.gerarMapa(m);
}

try { main(); } catch { /* hook nunca deve travar a conversa */ }
