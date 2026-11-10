# TrivanoHub

Gestão simples de e-commerce (Mercado Livre, Amazon, loja própria) para uma equipe pequena: **quanto sobra de cada venda e de cada mês**.

## Subir no Windows (Docker Desktop)

1. Abra o Docker Desktop.
2. Dê dois cliques em `subir.bat`. Na primeira vez ele cria o `.env` com senhas aleatórias e salva os acessos em `LOGINS.txt`.
3. Acesse **http://localhost:3090**.

Para atualizar depois de mudar o código, rode o `subir.bat` de novo: o banco é preservado (volume `gestorshop_pgdata`) e há backup diário em `./backups`.

## Online (VPS)

Passo a passo completo em [docs/VPS.md](docs/VPS.md): VPS Ubuntu + domínio, um comando para instalar (`scripts/instalar-vps.sh`), HTTPS automático com Caddy, backup diário e script de atualização.

## Telas

| Tela | O que faz |
| --- | --- |
| Painel | Faturamento, lucro líquido, meta do mês, "para onde vai cada R$ 100", 12 meses, alertas de margem e estoque |
| Vendas | Lança vendas com prévia do lucro; tarifas, frete, imposto e custo ficam gravados na venda; cancelamento devolve o estoque |
| Calculadora | Clássico × Premium lado a lado e preço mínimo para a margem desejada |
| Produtos e estoque | Custo médio, embalagem, frete médio, entrada de mercadoria (recalcula o custo médio) e inventário |
| Fornecedores / Cotações | Compara propostas pelo custo final por unidade e pela margem; aprovar dá entrada no estoque e lança a conta a pagar |
| Caixa | Contas com saldo, entradas e saídas, pagos e em aberto, repetição mensal |
| Impostos | Simples Nacional (Anexo I) com alíquota efetiva pelo RBT12, MEI ou alíquota manual; gera a conta do DAS |
| Investimentos | Aplicações (rendimento) e investimentos no negócio (payback); reserva em meses de despesa fixa |
| Metas e escala | Meta de lucro mensal com projeção e "quanto falta por dia"; plano de escala do Mercado Livre e da Amazon |
| Usuários / Configurações | 2 perfis (Administrador e Membro), empresa, regime, canais e tarifas, contas, categorias |

## Como o lucro é calculado

Lucro da venda = preço − comissão − tarifa por unidade (abaixo do limite do canal) − frete pago pela loja − anúncios − imposto − custo − embalagem.

Lucro líquido do mês = soma do lucro das vendas − despesas fixas e variáveis do Caixa + outras receitas. Compras de mercadoria viram estoque (não são despesa), o imposto já está em cada venda e retiradas dos sócios aparecem à parte.

As tarifas dos canais vêm com valores de referência: **confira a comissão da sua categoria** na central de vendedores e ajuste em Configurações.

## Desenvolvimento

```bash
npm install
npm test            # testes do cálculo de lucro, preço ideal e Simples
npx tsc --noEmit
```

Stack: Next.js 15, TypeScript, Tailwind, PostgreSQL 16, Prisma 6, Docker Compose.
