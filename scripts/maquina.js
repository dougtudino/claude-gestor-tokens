#!/usr/bin/env node
// Nome deste computador na central de comando (NB, MAC, DK...) e pasta sincronizada.
// Uso: node maquina.js                       → mostra a configuração
//      node maquina.js --nome NB --descricao "Notebook (principal)" [--central "G:\Meu Drive\_CLAUDE"]
//      node maquina.js --mapa                → refaz SESSOES.md com o que já está na central
'use strict';
const C = require('./central');

const args = process.argv.slice(2);
const opt = nome => {
  const i = args.indexOf(nome);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
};

function main() {
  const nome = opt('--nome');
  const descricao = opt('--descricao');
  const central = opt('--central');
  const m = nome || descricao || central ? C.configurar({ nome, descricao, central }) : C.maquina();
  if (args.includes('--mapa') && m.central) C.gerarMapa(m);
  const linhas = [
    `PC: ${m.nome}${m.descricao ? ' — ' + m.descricao : ''} (hostname ${m.host})${m.configurada ? '' : ' · NOME NÃO CONFIGURADO'}`,
    `Central: ${m.central || 'NENHUMA — crie a pasta _CLAUDE no Google Drive ou passe --central <pasta sincronizada>'}`,
  ];
  process.stdout.write(linhas.join('\n') + '\n');
}

main();
