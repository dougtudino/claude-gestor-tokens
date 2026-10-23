#!/usr/bin/env node
// Statusline: modelo · contexto (barra colorida) · custo da sessão · projeto (branch).
// Autocontido de propósito: a skill instalar-statusline copia só este arquivo para ~/.claude/.
'use strict';
const fs = require('fs');
const path = require('path');

const COR = { verde: '\x1b[32m', amarelo: '\x1b[33m', vermelho: '\x1b[31m', cinza: '\x1b[90m', fim: '\x1b[0m' };

function k(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}

function branch(dir) {
  try {
    let d = dir;
    while (d && !fs.existsSync(path.join(d, '.git'))) {
      const pai = path.dirname(d);
      if (pai === d) return '';
      d = pai;
    }
    let git = path.join(d, '.git');
    if (fs.statSync(git).isFile()) { // worktree: ".git" aponta para o gitdir
      git = path.resolve(d, fs.readFileSync(git, 'utf8').replace('gitdir:', '').trim());
    }
    const head = fs.readFileSync(path.join(git, 'HEAD'), 'utf8').trim();
    return head.startsWith('ref: refs/heads/') ? head.slice(16) : head.slice(0, 7);
  } catch {
    return '';
  }
}

function main() {
  let d = {};
  try { d = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { /* sem dados */ }

  const modelo = (d.model && (d.model.display_name || d.model.id)) || 'Claude';
  const cw = d.context_window || {};
  const janela = cw.context_window_size || 200000;
  const u = cw.current_usage;
  const usados = u
    ? (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0)
    : 0;
  const pct = typeof cw.used_percentage === 'number' ? Math.round(cw.used_percentage) : Math.round((usados / janela) * 100);

  const cor = pct >= 80 ? COR.vermelho : pct >= 60 ? COR.amarelo : COR.verde;
  const cheios = Math.min(10, Math.round(pct / 10));
  const barra = '█'.repeat(cheios) + '░'.repeat(10 - cheios);
  const ctx = `${cor}${barra} ${pct}%${COR.fim} ${COR.cinza}(${k(usados)}/${k(janela)})${COR.fim}`;

  const partes = [`🧠 ${modelo}`, ctx];
  const custo = d.cost && d.cost.total_cost_usd;
  if (typeof custo === 'number') partes.push(`$${custo.toFixed(2)}`);

  const dir = (d.workspace && (d.workspace.project_dir || d.workspace.current_dir)) || d.cwd || process.cwd();
  const b = branch(dir);
  partes.push(`📁 ${path.basename(dir)}${b ? ` ${COR.cinza}(${b})${COR.fim}` : ''}`);
  if (d.session_name) partes.push(`${COR.cinza}${d.session_name}${COR.fim}`);
  else partes.push(`${COR.amarelo}sem nome → /rename${COR.fim}`);

  process.stdout.write(partes.join(' · '));
}

main();
