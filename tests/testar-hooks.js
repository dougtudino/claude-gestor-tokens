#!/usr/bin/env node
// Testa os hooks com um projeto e uma transcrição falsos. Uso: node tests/testar-hooks.js
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RAIZ_PLUGIN = path.resolve(__dirname, '..');
const TMP = path.join(__dirname, 'tmp');
const PROJ = path.join(TMP, 'projeto-teste');
const DADOS = path.join(TMP, 'dados');
const SID = 'teste-' + Date.now();

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(path.join(PROJ, '.git'), { recursive: true });
fs.mkdirSync(DADOS, { recursive: true });

function transcricao(tokens, extras = []) {
  const ts = new Date(Date.now() - 60000).toISOString();
  const linhas = [
    { type: 'user', timestamp: ts, message: { role: 'user', content: 'Cria a tela de login com Google' } },
    { type: 'user', timestamp: ts, message: { role: 'user', content: '<command-name>/context</command-name>' } },
    { type: 'user', timestamp: ts, message: { role: 'user', content: 'Agora adiciona testes' } },
    { type: 'user', timestamp: ts, message: { role: 'user', content: [{ type: 'text', text: 'E corrige o lint' }] } },
    {
      type: 'assistant', timestamp: ts, gitBranch: 'feat/login',
      message: {
        model: 'claude-sonnet-4-5',
        content: [{ type: 'tool_use', name: 'Edit', input: { file_path: path.join(PROJ, 'src', 'login.ts') } }],
        usage: { input_tokens: 5, cache_creation_input_tokens: 1000, cache_read_input_tokens: tokens - 1205, output_tokens: 200 },
      },
    },
    // Subagente e mensagem sintética (erro do Claude Code): não devem contar
    { type: 'assistant', isSidechain: true, message: { model: 'x', usage: { input_tokens: 999999 } } },
    { type: 'assistant', message: { model: '<synthetic>', usage: { input_tokens: 0, output_tokens: 0 } } },
    ...extras,
  ];
  const f = path.join(TMP, `t-${tokens}.jsonl`);
  fs.writeFileSync(f, linhas.map(l => JSON.stringify(l)).join('\n') + '\n');
  return f;
}

function rodar(script, entrada, args = []) {
  const out = execFileSync('node', [path.join(RAIZ_PLUGIN, 'scripts', script), ...args], {
    input: JSON.stringify(entrada),
    env: { ...process.env, CLAUDE_PLUGIN_DATA: DADOS, GESTOR_JANELA: '', GESTOR_DICA_TOKENS: '', GESTOR_AVISO_TOKENS: '' },
    encoding: 'utf8',
  });
  return out.trim() ? JSON.parse(out) : null;
}

let ok = 0;
function caso(nome, fn) {
  fn();
  ok++;
  console.log('✔', nome);
}

const base = { session_id: SID, cwd: PROJ };

caso('início sem CLAUDE.md sugere organizar e mostra dica', () => {
  const r = rodar('inicio-sessao.js', { ...base, source: 'startup' });
  assert.match(r.systemMessage, /organizar/);
  assert.match(r.systemMessage, /💡/);
});

caso('contexto baixo não avisa', () => {
  assert.strictEqual(rodar('medir-contexto.js', { ...base, transcript_path: transcricao(50000) }), null);
});

caso('contexto 65% de 200k dá dica uma vez', () => {
  const t = transcricao(130000);
  const r = rodar('medir-contexto.js', { ...base, transcript_path: t });
  assert.match(r.systemMessage, /💡 Contexto em 130k tokens \(65% de 200k\)/);
  assert.strictEqual(rodar('medir-contexto.js', { ...base, transcript_path: t }), null);
});

caso('contexto 85% dá aviso e contexto para o Claude', () => {
  const r = rodar('medir-contexto.js', { ...base, transcript_path: transcricao(170000) });
  assert.match(r.systemMessage, /⚠️/);
  assert.strictEqual(r.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
});

caso('depois de compactar, volta a avisar quando sobe de novo', () => {
  assert.strictEqual(rodar('medir-contexto.js', { ...base, transcript_path: transcricao(40000) }), null);
  assert.ok(rodar('medir-contexto.js', { ...base, transcript_path: transcricao(130000) }));
});

caso('PostCompact grava nota com resumo, pedidos e arquivos', () => {
  rodar('autosalvar.js', {
    ...base, transcript_path: transcricao(130000), trigger: 'manual', compact_summary: 'Resumo: login quase pronto.',
  }, ['compact']);
  const dir = path.join(PROJ, '.claude', 'sessoes');
  const nota = fs.readdirSync(dir).find(f => f.endsWith('-auto-compact.md'));
  assert.ok(nota, 'nota criada');
  const txt = fs.readFileSync(path.join(dir, nota), 'utf8');
  assert.match(txt, /Resumo: login quase pronto/);
  assert.match(txt, /Cria a tela de login com Google/);
  assert.match(txt, /E corrige o lint/);
  assert.doesNotMatch(txt, /command-name/);
  assert.match(txt, /`src\/login\.ts`/);
  assert.match(txt, /feat\/login/);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'ULTIMA.md'), 'utf8').trim(), `@.claude/sessoes/${nota}`);
});

caso('SessionEnd não duplica se já salvou nesta sessão', () => {
  const dir = path.join(PROJ, '.claude', 'sessoes');
  const antes = fs.readdirSync(dir).length;
  rodar('autosalvar.js', { ...base, transcript_path: transcricao(130000), reason: 'prompt_input_exit' }, ['fim']);
  assert.strictEqual(fs.readdirSync(dir).length, antes);
});

caso('início com nota existente aponta a última sessão', () => {
  const r = rodar('inicio-sessao.js', { ...base, source: 'resume' });
  assert.match(r.systemMessage, /📌 Última sessão: projeto-teste · nota automática \(hoje\)/);
  assert.match(r.hookSpecificOutput.additionalContext, /\.claude\/sessoes\//);
});

caso('fora de projeto não cria nada', () => {
  const solto = path.join(TMP, 'solto');
  fs.mkdirSync(solto);
  rodar('autosalvar.js', { session_id: SID, cwd: solto, transcript_path: transcricao(130000) }, ['compact']);
  assert.ok(!fs.existsSync(path.join(solto, '.claude')));
});

caso('statusline formata modelo, contexto, custo e projeto', () => {
  const out = execFileSync('node', [path.join(RAIZ_PLUGIN, 'scripts', 'statusline.js')], {
    input: JSON.stringify({
      model: { display_name: 'Sonnet 5.5' },
      context_window: { context_window_size: 200000, used_percentage: 62, current_usage: { input_tokens: 124000 } },
      cost: { total_cost_usd: 1.84 },
      workspace: { project_dir: PROJ },
    }),
    encoding: 'utf8',
  });
  const limpo = out.replace(/\x1b\[\d+m/g, '');
  assert.match(limpo, /🧠 Sonnet 5\.5 · ██████░░░░ 62% \(124k\/200k\) · \$1\.84 · 📁 projeto-teste/);
  assert.match(limpo, /sem nome → \/rename/);
});

caso('entrada vazia nunca quebra', () => {
  for (const s of ['inicio-sessao.js', 'medir-contexto.js', 'autosalvar.js', 'statusline.js']) {
    execFileSync('node', [path.join(RAIZ_PLUGIN, 'scripts', s)], { input: '', env: { ...process.env, CLAUDE_PLUGIN_DATA: DADOS } });
  }
});

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${ok} testes passaram.`);
