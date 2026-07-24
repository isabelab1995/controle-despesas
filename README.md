# Controle de Despesas — site pessoal

Site para controlar suas despesas e receitas pessoais, feito a partir da sua planilha
`Controle_de_Despesas_Isabela_v2.xlsx`. Funciona no celular e no computador, guarda os
dados na nuvem (Firebase, gratuito) e pode ser publicado de graça no GitHub Pages.

## O que já vem pronto

- Todo o histórico de lançamentos "Real" da aba **Lançamentos** da sua planilha
  (2074 lançamentos, de 01/2023 a 07/2026), prontos para importar com um clique.
- Painel do mês: saldo, entradas e saídas.
- Gráfico de saldo acumulado (histórico completo) e gráfico de saídas por categoria do mês.
- Lista de lançamentos com filtro por tipo, origem e categoria, busca e exportação em CSV.
- Cadastro, edição e exclusão de lançamentos.

## Passo 1 — Criar o banco de dados gratuito (Firebase)

1. Acesse **https://console.firebase.google.com** e entre com sua conta Google.
2. Clique em **"Criar projeto"**, dê um nome (ex: `controle-despesas-isabela`) e conclua a criação
   (pode desativar o Google Analytics, não é necessário).
3. No menu lateral, vá em **Compilação → Firestore Database** → **"Criar banco de dados"**.
   - Escolha a localização mais próxima (ex: `southamerica-east1`).
   - Selecione **"Iniciar no modo de produção"**.
4. Ainda no Firestore, clique na aba **"Regras"** e substitua o conteúdo por:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /lancamentos/{doc} {
         allow read, write: if request.time < timestamp.date(2027, 12, 31);
       }
     }
   }
   ```

   > Isso libera leitura/escrita até o fim de 2027 sem exigir login — simples de configurar,
   > mas qualquer pessoa com o link do site poderia acessar os dados. Se quiser mais segurança,
   > me avise depois que posso te ajudar a adicionar um login (Firebase Authentication).
   > Clique em **"Publicar"** para salvar as regras.

5. Volte para **Visão geral do projeto** (ícone de casa) → clique no ícone **`</>`** ("Web")
   para adicionar um app da Web.
   - Dê um apelido (ex: `site-despesas`) e clique em **"Registrar app"**.
   - Copie o objeto `firebaseConfig` que aparece na tela — algo como:

     ```js
     const firebaseConfig = {
       apiKey: "AIzaSy...",
       authDomain: "controle-despesas-isabela.firebaseapp.com",
       projectId: "controle-despesas-isabela",
       storageBucket: "controle-despesas-isabela.appspot.com",
       messagingSenderId: "123456789",
       appId: "1:123456789:web:abcdef123456"
     };
     ```
   - Guarde esse texto — você vai colar na primeira tela do site.

## Passo 2 — Publicar o site gratuitamente no GitHub Pages

1. Crie uma conta em **https://github.com** (se ainda não tiver) e clique em **"New repository"**.
   - Nome sugerido: `controle-despesas`. Marque como **Público**. Crie o repositório.
2. Dentro do repositório, clique em **"Add file" → "Upload files"** e envie estes arquivos:
   `index.html`, `style.css`, `app.js`, `dados_iniciais.js`.
3. Vá em **Settings → Pages** (menu lateral do repositório).
   - Em "Source", selecione a branch `main` e a pasta `/root`. Clique em **Save**.
4. Aguarde 1–2 minutos. O GitHub mostrará o endereço do site, algo como:
   `https://seu-usuario.github.io/controle-despesas/`

## Passo 3 — Primeiro acesso

1. Abra o link do site. Na primeira tela, cole o objeto `firebaseConfig` do Passo 1
   (pode colar exatamente como copiou, com `const firebaseConfig = {...}` — o site aceita
   o JSON dentro das chaves também) e clique em **"Conectar e continuar"**.
2. O site vai perguntar se você quer importar o histórico da planilha — clique em
   **"Importar histórico"** (só acontece uma vez).
3. Pronto! Os dados ficam salvos na nuvem. Em outro celular/computador, basta colar o mesmo
   `firebaseConfig` para acessar as mesmas informações.

## Sobre custos

O plano gratuito do Firebase (Spark) permite até 50 mil leituras e 20 mil gravações por dia —
muito acima do que um controle de despesas pessoal usa. Não é necessário cadastrar cartão de
crédito.

## Arquivos deste projeto

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura da página |
| `style.css` | Visual (tema "livro-caixa") |
| `app.js` | Lógica: conexão com o Firebase, cálculos, formulários |
| `dados_iniciais.js` | Histórico extraído da sua planilha, usado só na importação inicial |
| `README.md` | Este guia |

## Dúvidas comuns

- **"Errei o firebaseConfig, como corrijo?"** — Clique em "Trocar banco de dados" no topo do
  site e cole novamente.
- **"Quero acessar do celular"** — É só abrir o mesmo link do GitHub Pages no navegador do
  celular e colar o mesmo `firebaseConfig`.
- **"Posso editar as categorias?"** — Sim, ao cadastrar um lançamento escolha "Outra (digitar)"
  na lista de categorias.
