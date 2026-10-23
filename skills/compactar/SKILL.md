---
name: compactar
description: Prepara uma compactação segura da conversa — salva a nota de sessão e escreve as instruções certas para o /compact manter o que importa. Use quando o contexto estiver alto (60%+), quando o usuário pedir para compactar, limpar ou "aliviar" a conversa, ou antes de mudar de fase (ex.: terminou a investigação e vai implementar).
---

# Compactar do jeito certo

`/compact` resume a conversa e libera contexto, mas o resumo perde detalhes. A ordem certa é:
**salvar → compactar com instruções → conferir**.

## Passos

1. Rode a skill `salvar` (mesmo fluxo de `/gestor-tokens:salvar`) para gravar a nota.
2. Decida entre compactar e limpar:
   - **`/clear`** se a próxima tarefa é diferente da atual (a nota já guarda o necessário;
     a sessão nova começa leve). Depois, `/gestor-tokens:retomar`.
   - **`/compact <instruções>`** se vai continuar a mesma tarefa.
3. Escreva as instruções do `/compact` (o usuário cola e roda; você não consegue rodar
   comandos de barra). Modelo:

```
/compact Manter: objetivo (<1 linha>), decisões tomadas e motivos, pendências em ordem,
caminhos dos arquivos em edição, comandos de teste/build que funcionam, erros já resolvidos
e a causa. Descartar: saídas longas de ferramentas, arquivos lidos só para consulta,
tentativas que não deram certo.
```

4. Entregue em no máximo 6 linhas: a nota salva, o comando pronto para copiar, e
   "depois do compact, rode `/context` para conferir".

## Quando NÃO compactar

- No meio de uma edição de vários arquivos ainda não testada: termine o passo atual primeiro.
- Se o contexto está abaixo de 40%: não vale o custo; siga trabalhando.
