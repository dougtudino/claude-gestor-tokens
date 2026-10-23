#!/usr/bin/env node
// UserPromptSubmit: mede o contexto contra o ponto de compactação automática.
// Em 70% manda o Claude salvar a nota sozinho; em 90% avisa que a compactação vem aí.
'use strict';
const L = require('./lib');

const SALVAR_PCT = parseInt(process.env.GESTOR_SALVAR_PCT || '70', 10);
const URGENTE_PCT = parseInt(process.env.GESTOR_URGENTE_PCT || '90', 10);

function main() {
  const entrada = L.lerStdin();
  const { tokens, modelo } = L.usoDoContexto(L.lerJsonl(entrada.transcript_path));
  if (!tokens) return;

  const limite = L.limiteDeCompactacao(modelo, entrada.cwd);
  const pct = Math.round((tokens / limite) * 100);
  const n = pct >= URGENTE_PCT ? 2 : pct >= SALVAR_PCT ? 1 : 0;

  const estado = L.lerEstado(entrada.session_id);
  const avisado = estado.nivel || 0;
  // Depois da compactação o nível cai: libera agir de novo quando subir.
  if (n < avisado) L.gravarEstado(entrada.session_id, { ...estado, nivel: n });
  if (n === 0 || n <= avisado) return;
  L.gravarEstado(entrada.session_id, { ...estado, nivel: n });

  const uso = `${L.fmtTokens(tokens)} de ${L.fmtTokens(limite)} (${pct}% do ponto de compactação)`;
  const instrucao =
    `[gestor-tokens] A conversa está em ${uso}; a compactação automática vem aí. ` +
    'Sem perguntar ao usuário: ao terminar o que ele pediu nesta mensagem, rode a skill gestor-tokens:salvar ' +
    '(se estiver no meio de uma edição de vários arquivos, termine o passo antes). ' +
    'Depois diga em uma linha que a nota foi salva. Não proponha /compact: ele acontece sozinho.';

  L.responder({
    systemMessage: n === 1
      ? `💾 Contexto em ${uso} — o Claude vai salvar a nota da sessão antes da compactação automática.`
      : `⚠️ Contexto em ${uso} — compactação automática iminente; salvando a nota agora.`,
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: instrucao },
  });
}

try { main(); } catch { /* hook nunca deve travar a conversa */ }
