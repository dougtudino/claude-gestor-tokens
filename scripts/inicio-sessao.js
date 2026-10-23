#!/usr/bin/env node
// SessionStart: aponta a última nota de sessão do projeto e mostra uma dica.
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const DICAS = [
  '/rename <Projeto> · <assunto> logo no começo — sessão sem nome some na lista do /resume.',
  '/context mostra o que ocupa a janela antes de você culpar o modelo.',
  'Uma conversa por assunto: ao trocar de assunto, /gestor-tokens:salvar e depois /clear.',
  '/compact <o que manter> no fim de cada fase é melhor que esperar a compactação automática.',
  'Busca larga no projeto? Peça um subagente: volta só a conclusão, não os arquivos.',
  'Peça leitura por trecho ("a função X", "linhas 100–200") em vez do arquivo inteiro.',
  'Plan mode (Shift+Tab ou /plan) antes de mudança grande: alinhar o plano custa menos que refazer.',
  'Sonnet para o dia a dia, Opus para o difícil, Haiku para o mecânico: /gestor-tokens:modelo <tarefa>.',
  'Trocar de modelo no meio da conversa perde o cache do prompt: troque em pontos de parada.',
  'CLAUDE.md é lido em toda mensagem: mantenha com ~150 linhas e mande detalhes para docs/.',
  'Log enorme? Salve em arquivo e peça para buscar o erro nele, em vez de colar na conversa.',
  '/usage mostra custo da sessão e limites do plano.',
  'claude -c retoma a última conversa da pasta; claude -r <nome> retoma uma pelo nome.',
  '/gestor-tokens:checkup mede o que pesa em toda mensagem (memória, MCPs, skills).',
];

const MAX_NOTA = 3500;

// Regras de economia que o Claude segue sozinho em toda sessão (curtas: pesam em todo início).
function politica(modelo) {
  return [
    '[gestor-tokens] Regras de economia desta sessão, siga sem anunciar:',
    '- Busca larga ou leitura de muitos arquivos: delegue a um subagente (Agent com model "haiku", ou Explore) e traga só a conclusão.',
    '- Arquivo grande: leia por trecho. Saída longa de comando: filtre (tail, grep) antes de trazer.',
    `- Modelo desta sessão: ${modelo || 'desconhecido'}. Se o pedido for claramente mecânico e o modelo for Opus/Fable, ` +
      'ou claramente difícil e o modelo for Haiku, sugira uma vez, numa linha, o /model adequado; não insista.',
    '- Ao concluir uma entrega grande (feature, correção, decisão de arquitetura), rode a skill gestor-tokens:salvar sem perguntar.',
  ].join('\n');
}

function main() {
  const entrada = L.lerStdin();
  const origem = entrada.source || 'startup';
  const raiz = L.raizDoProjeto(entrada.cwd);
  const contexto = [];
  const tela = [];

  if (origem !== 'resume') contexto.push(politica(entrada.model));

  if (raiz) {
    const nota = L.ultimaNota(raiz);
    if (nota) {
      const rel = path.relative(raiz, nota).split(path.sep).join('/');
      const dias = Math.floor((Date.now() - fs.statSync(nota).mtimeMs) / 86400000);
      const texto = fs.readFileSync(nota, 'utf8');
      const titulo = (texto.split('\n').find(l => l.startsWith('# ')) || '').slice(2).trim();
      const idade = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
      if (origem === 'startup' || origem === 'clear') {
        // Retomar sem comando: a nota já entra no contexto (depois do /compact o resumo faz esse papel).
        tela.push(`📌 Última sessão: ${titulo || rel} (${idade}) — já carreguei a nota; é só dizer "continua".`);
        contexto.push(
          `[gestor-tokens] Nota da última sessão deste projeto (${rel}, ${idade}). ` +
          'Use só se o pedido do usuário continuar esse trabalho; se for outro assunto, ignore.' +
          (dias > 14 ? ' A nota é antiga: confira o código antes de confiar nela.' : '') +
          '\n\n' + (texto.length > MAX_NOTA ? texto.slice(0, MAX_NOTA) + '\n[...nota cortada; leia o arquivo se precisar]' : texto)
        );
      }
    } else if (!fs.existsSync(path.join(raiz, 'CLAUDE.md')) && !fs.existsSync(path.join(raiz, '.claude', 'CLAUDE.md'))) {
      tela.push('🗂️ Projeto sem CLAUDE.md — /gestor-tokens:organizar deixa no padrão.');
    }
  }

  if (origem === 'startup' || origem === 'clear') {
    tela.push('💡 ' + DICAS[Math.floor(Math.random() * DICAS.length)]);
  }

  // Sessão nova (ou depois de /clear) começa sem avisos de contexto pendentes.
  if (origem !== 'resume') L.gravarEstado(entrada.session_id, { nivel: 0 });

  if (!tela.length && !contexto.length) return;
  const saida = {};
  if (tela.length) saida.systemMessage = tela.join('\n');
  if (contexto.length) {
    saida.hookSpecificOutput = { hookEventName: 'SessionStart', additionalContext: contexto.join('\n') };
  }
  L.responder(saida);
}

try { main(); } catch { /* hook nunca deve travar a conversa */ }
