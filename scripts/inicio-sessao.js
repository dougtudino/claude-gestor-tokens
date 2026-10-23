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

function main() {
  const entrada = L.lerStdin();
  const origem = entrada.source || 'startup';
  const raiz = L.raizDoProjeto(entrada.cwd);
  const contexto = [];
  const tela = [];

  if (raiz) {
    const nota = L.ultimaNota(raiz);
    if (nota) {
      const rel = path.relative(raiz, nota).split(path.sep).join('/');
      const dias = Math.floor((Date.now() - fs.statSync(nota).mtimeMs) / 86400000);
      const titulo = (fs.readFileSync(nota, 'utf8').split('\n').find(l => l.startsWith('# ')) || '').slice(2).trim();
      const idade = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
      tela.push(`📌 Última sessão: ${titulo || rel} (${idade}) — /gestor-tokens:retomar para continuar`);
      contexto.push(
        `[gestor-tokens] Este projeto tem nota da última sessão em ${rel} (${idade}). ` +
        'Não leia agora; leia só se o usuário quiser continuar o trabalho anterior.'
      );
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
