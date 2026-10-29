# Comercial Soares — Sistema de Pedidos para Celulares

Projeto web mobile-first para uso em celulares Android e iPhone. A versão online usa React, TypeScript e Supabase para autenticação e armazenamento centralizado dos pedidos.

## Recursos implementados no código

- Interface adaptada para telas pequenas, com controles maiores para toque.
- Login por e-mail e senha usando Supabase Auth.
- Cadastro de pedidos, produtos, quantidades e preços com cálculo automático.
- Importação no formato antigo da Comercial Soares: quantidade + nome do produto + `vPREÇO`, com vários itens em sequência no mesmo campo.
- Histórico com pesquisa, impressão/Salvar como PDF e exclusão.
- Botão **Reabrir**: retorna o pedido ao formulário, marca-o como aberto e permite salvar as alterações no mesmo registro.
- Banco de dados com políticas RLS para cada conta acessar apenas seus próprios pedidos.

## Importante antes de usar

O código está preparado, mas o site ainda não está publicado e depende da configuração da conta Supabase e do serviço de hospedagem. Não use em operação real até configurar e testar login, permissões, importação, edição e impressão.

## Configuração do banco online

1. Crie um projeto em https://supabase.com/.
2. No painel, abra **SQL Editor**.
3. Abra `supabase-schema.sql`, copie o conteúdo e execute no SQL Editor.
4. Em **Authentication → Users**, crie um usuário com e-mail e senha.
5. Em **Project Settings → API**, copie a URL do projeto e a chave publicável (anon). **Nunca use a chave `service_role` no site.**

## Configurar o projeto

1. Instale Node.js LTS pelo site oficial: https://nodejs.org/.
2. Copie `.env.example` para `.env.local`.
3. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os dados do seu projeto.
4. No Terminal, dentro da pasta do projeto, execute:

```bash
npm install
npm run dev
```

## Publicar na internet

O projeto pode ser publicado em um serviço como Vercel. Será necessário conectar um repositório e cadastrar as mesmas variáveis de ambiente no painel de hospedagem. Depois da publicação, o endereço poderá ser aberto no Safari do iPhone e no Chrome do Android.

## Observações

- A tabela de pedidos começa vazia; pedidos antigos não são importados.
- A prévia HTML separada salva dados somente no navegador e **não sincroniza** entre celulares. Use o projeto online depois de configurar Supabase e hospedagem para ter sincronização real.
- O campo de importação segue a lógica antiga: a quantidade inicia cada item, e o preço é identificado por um token começando com `v` seguido do valor. Confira os itens importados antes de salvar.
