# Plano

## O que será entregue

- Criar uma área de **Auditoria** no sistema para consultar ações feitas pelos usuários.
- Registrar melhor quem criou, alterou ou excluiu dados importantes, com data e hora.
- Melhorar o menu lateral para ficar com aparência mais profissional de sistema empresarial.
- Refinar o layout principal com topo mais informativo e acabamento visual mais robusto.

## Auditoria

- Aproveitar a tabela de logs já existente e ampliar a cobertura para áreas que ainda não registram tudo.
- Garantir logs para alterações em clínica, usuários/permissões, agenda, cadastros, financeiro, patrimônio e parcelas.
- Exibir no sistema uma lista pesquisável dos eventos com:
  - ação realizada;
  - área afetada;
  - usuário responsável;
  - data e hora;
  - identificação do registro alterado.

## Menu e layout

- Reorganizar o menu lateral com grupos mais claros, indicadores visuais e melhor leitura.
- Destacar a clínica Virtuosa, papel do usuário e status do sistema.
- Melhorar o cabeçalho das páginas com informação de usuário, data e ações de conta.
- Preservar o padrão atual de cores neutras com azul como principal.

## Detalhes técnicos

- Criar uma migration no Lovable Cloud para atualizar a função de log e adicionar triggers onde faltam.
- Não expor chaves privadas no frontend.
- Criar a página `/auditoria` usando os logs do banco atual.
- Atualizar permissões do frontend para que a auditoria fique restrita a administradores/segurança.
- Manter a compatibilidade com a clínica Virtuosa já fixada no sistema.
