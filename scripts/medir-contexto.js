#!/usr/bin/env node
// UserPromptSubmit: mede o contexto e avisa uma vez por faixa (dica, aviso).
'use strict';
const L = require('./lib');

const DICA_PCT = 60;
const AVISO_PCT = 80;
const DICA_TOKENS = parseInt(process.env.GESTOR_DICA_TOKENS || '150000', 10);
const AVISO_TOKENS = parseInt(process.env.GESTOR_AVISO_TOKENS || '300000', 10);

function nivel(tokens, pct) {
  if (pct >= AVISO_PCT || tokens >= AVISO_TOKENS) return 2;
  if (pct >= DICA_PCT || tokens >= DICA_TOKENS) return 1;
  return 0;
}

function main() {
  const entrada = L.lerStdin();
  const { tokens, modelo } = L.usoDoContexto(L.lerJsonl(entrada.transcript_path));
  if (!tokens) return;

  const janela = L.janelaDoModelo(modelo);
  const pct = Math.round((tokens / janela) * 100);
  const n = nivel(tokens, pct);

  const estado = L.lerEstado(entrada.session_id);
  const avisado = estado.nivel || 0;
  // Depois de /compact ou /clear o nível cai: libera avisar de novo quando subir.
  if (n < avisado) L.gravarEstado(entrada.session_id, { ...estado, nivel: n });
  if (n === 0 || n <= avisado) return;
  L.gravarEstado(entrada.session_id, { ...estado, nivel: n });

  const uso = `${L.fmtTokens(tokens)} tokens (${pct}% de ${L.fmtTokens(janela)})`;
  if (n === 1) {
    L.responder({
      systemMessage: `💡 Contexto em ${uso} — cada mensagem relê tudo isso. No próximo ponto de parada: /gestor-tokens:compactar`,
    });
    return;
  }
  L.responder({
    systemMessage: `⚠️ Contexto em ${uso} → rode /gestor-tokens:salvar e depois /compact (ou /clear se for mudar de assunto).`,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext:
        `[gestor-tokens] A conversa ocupa ${uso}. Ao terminar esta resposta, lembre o usuário em uma linha ` +
        'de salvar a sessão (/gestor-tokens:salvar) e compactar, se o trabalho estiver num ponto de parada.',
    },
  });
}

try { main(); } catch { /* hook nunca deve travar a conversa */ }
