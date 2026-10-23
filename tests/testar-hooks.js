#!/usr/bin/env node
// Testa hooks e scripts com projetos e transcrições falsos. Uso: node tests/testar-hooks.js
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
const SESSOES = path.join(PROJ, '.claude', 'sessoes');

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(path.join(PROJ, '.git'), { recursive: true });
fs.mkdirSync(DADOS, { recursive: true });

// Ambiente previsível: ponto de compactação em 200k, sem herdar ajustes do usuário.
const ENV = {
  ...process.env, CLAUDE_PLUGIN_DATA: DADOS, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '200k',
  GESTOR_JANELA: '', GESTOR_SALVAR_PCT: '', GESTOR_URGENTE_PCT: '',
};

let n = 0;
function transcricao(tokens, { cwd = PROJ, idadeMs = 60000 } = {}) {
  const ts = new Date(Date.now() - idadeMs).toISOString();
  const linhas = [
    { type: 'custom-title', customTitle: 'Login com Google' },
    { type: 'user', cwd, timestamp: ts, message: { role: 'user', content: 'Cria a tela de login com Google' } },
    { type: 'user', cwd, timestamp: ts, message: { role: 'user', content: '<command-name>/context</command-name>' } },
    { type: 'user', cwd, timestamp: ts, message: { role: 'user', content: 'Agora adiciona testes' } },
    { type: 'user', cwd, timestamp: ts, message: { role: 'user', content: [{ type: 'text', text: 'E corrige o lint' }] } },
    {
      type: 'assistant', cwd, timestamp: ts, gitBranch: 'feat/login',
      message: {
        model: 'claude-sonnet-5-5',
        content: [{ type: 'tool_use', name: 'Edit', input: { file_path: path.join(PROJ, 'src', 'login.ts') } }],
        usage: { input_tokens: 5, cache_creation_input_tokens: 1000, cache_read_input_tokens: tokens - 1205, output_tokens: 200 },
      },
    },
    // Subagente e mensagem sintética (erro do Claude Code): não devem contar
    { type: 'assistant', isSidechain: true, message: { model: 'x', usage: { input_tokens: 999999 } } },
    { type: 'assistant', message: { model: '<synthetic>', usage: { input_tokens: 0, output_tokens: 0 } } },
  ];
  const f = path.join(TMP, `t-${n++}.jsonl`);
  fs.writeFileSync(f, linhas.map(l => JSON.stringify(l)).join('\n') + '\n');
  return f;
}

function rodar(script, entrada, args = []) {
  const out = execFileSync('node', [path.join(RAIZ_PLUGIN, 'scripts', script), ...args], {
    input: JSON.stringify(entrada), env: ENV, encoding: 'utf8',
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
const notas = () => (fs.existsSync(SESSOES) ? fs.readdirSync(SESSOES).filter(f => f !== 'ULTIMA.md') : []);

caso('início sem CLAUDE.md: sugere organizar, dica e política de economia', () => {
  const r = rodar('inicio-sessao.js', { ...base, source: 'startup', model: 'claude-opus-5-5' });
  assert.match(r.systemMessage, /organizar/);
  assert.match(r.systemMessage, /💡/);
  assert.match(r.hookSpecificOutput.additionalContext, /model "haiku"/);
  assert.match(r.hookSpecificOutput.additionalContext, /Modelo desta sessão: claude-opus-5-5/);
});

caso('contexto em 50% do ponto de compactação: silêncio', () => {
  assert.strictEqual(rodar('medir-contexto.js', { ...base, transcript_path: transcricao(100000) }), null);
});

caso('70%: manda o Claude salvar sozinho, uma vez só', () => {
  const t = transcricao(140000);
  const r = rodar('medir-contexto.js', { ...base, transcript_path: t });
  assert.match(r.systemMessage, /💾 Contexto em 140k de 200k \(70% do ponto de compactação\)/);
  assert.match(r.hookSpecificOutput.additionalContext, /Sem perguntar.*gestor-tokens:salvar/);
  assert.strictEqual(rodar('medir-contexto.js', { ...base, transcript_path: t }), null);
});

caso('90%: aviso de compactação iminente', () => {
  const r = rodar('medir-contexto.js', { ...base, transcript_path: transcricao(185000) });
  assert.match(r.systemMessage, /⚠️.*iminente/);
});

caso('depois da compactação, volta a agir quando sobe de novo', () => {
  assert.strictEqual(rodar('medir-contexto.js', { ...base, transcript_path: transcricao(40000) }), null);
  assert.ok(rodar('medir-contexto.js', { ...base, transcript_path: transcricao(140000) }));
});

caso('PostCompact grava nota com resumo, pedidos, arquivos e branch', () => {
  rodar('autosalvar.js', {
    ...base, transcript_path: transcricao(130000), trigger: 'auto', compact_summary: 'Resumo: login quase pronto.',
  }, ['compact']);
  const nota = notas().find(f => f.includes('-auto-compact'));
  assert.ok(nota, 'nota criada');
  const txt = fs.readFileSync(path.join(SESSOES, nota), 'utf8');
  assert.match(txt, /Resumo: login quase pronto/);
  assert.match(txt, /Cria a tela de login com Google/);
  assert.match(txt, /E corrige o lint/);
  assert.doesNotMatch(txt, /command-name/);
  assert.match(txt, /`src\/login\.ts`/);
  assert.match(txt, /feat\/login/);
  assert.match(txt, /Modelo: claude-sonnet-5-5/);
  assert.strictEqual(fs.readFileSync(path.join(SESSOES, 'ULTIMA.md'), 'utf8').trim(), `@.claude/sessoes/${nota}`);
});

caso('SessionEnd não duplica se já salvou nesta sessão', () => {
  const antes = notas().length;
  rodar('autosalvar.js', { ...base, transcript_path: transcricao(130000), reason: 'prompt_input_exit' }, ['fim']);
  assert.strictEqual(notas().length, antes);
});

caso('sessão nova já recebe a nota no contexto (retomar sem comando)', () => {
  const r = rodar('inicio-sessao.js', { ...base, source: 'startup' });
  assert.match(r.systemMessage, /📌 Última sessão: projeto-teste · nota automática \(hoje\) — já carreguei/);
  assert.match(r.hookSpecificOutput.additionalContext, /Resumo: login quase pronto/);
});

caso('ao retomar sessão (resume) não repete nota nem política', () => {
  assert.strictEqual(rodar('inicio-sessao.js', { ...base, source: 'resume' }), null);
});

caso('worktree do app grava a nota no projeto principal', () => {
  const wt = path.join(PROJ, '.claude', 'worktrees', 'feat-x');
  fs.mkdirSync(wt, { recursive: true });
  fs.writeFileSync(path.join(wt, '.git'), 'gitdir: ../../../.git/worktrees/feat-x');
  const antes = notas().length;
  rodar('autosalvar.js', { session_id: 'wt', cwd: wt, transcript_path: transcricao(130000, { cwd: wt }) }, ['compact']);
  assert.strictEqual(notas().length, antes + 1);
  assert.ok(!fs.existsSync(path.join(wt, '.claude', 'sessoes')));
});

caso('pasta-mãe com .claude (ex.: C:\\Projetos) não recebe nota de subpasta sem git', () => {
  const mae = path.join(TMP, 'Projetos');
  const filho = path.join(mae, 'jogo-sem-git');
  fs.mkdirSync(path.join(mae, '.claude'), { recursive: true });
  fs.mkdirSync(filho, { recursive: true });
  rodar('autosalvar.js', { session_id: 'm', cwd: filho, transcript_path: transcricao(130000, { cwd: filho }) }, ['compact']);
  assert.ok(!fs.existsSync(path.join(mae, '.claude', 'sessoes')));
  assert.ok(!fs.existsSync(path.join(filho, '.claude')));
});

caso('relatório do supervisor grava nota só de sessão pesada e parada, e não repete', () => {
  const pasta = path.join(TMP, 'projects', 'C--projeto-teste');
  fs.mkdirSync(pasta, { recursive: true });
  const pesada = path.join(pasta, 'aaaa1111-pesada.jsonl');
  const ativa = path.join(pasta, 'bbbb2222-ativa.jsonl');
  fs.copyFileSync(transcricao(250000), pesada);
  fs.copyFileSync(transcricao(250000), ativa);
  const tresHoras = new Date(Date.now() - 3 * 3600 * 1000);
  fs.utimesSync(pesada, tresHoras, tresHoras);
  fs.rmSync(SESSOES, { recursive: true, force: true });

  const rel = (...a) => execFileSync('node', [path.join(RAIZ_PLUGIN, 'scripts', 'relatorio-sessoes.js'),
    '--pasta', path.join(TMP, 'projects'), ...a], { env: ENV, encoding: 'utf8' });
  const primeira = rel('--gravar');
  assert.match(primeira, /Login com Google \| aaaa1111 \| 3h \| 250k \(125%\) \| sonnet-5-5 \| 3 \| GRAVADA/);
  assert.match(primeira, /bbbb2222 \| 0min .* \| sem \|/); // ativa: não mexe
  assert.match(primeira, /Notas gravadas agora: 1/);
  assert.strictEqual(notas().filter(f => f.includes('-auto-supervisor')).length, 1);
  assert.match(rel('--gravar'), /Notas gravadas agora: 0/);
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
    execFileSync('node', [path.join(RAIZ_PLUGIN, 'scripts', s)], { input: '', env: ENV });
  }
});

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${ok} testes passaram.`);
