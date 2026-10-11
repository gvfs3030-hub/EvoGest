export type Lesson = {
  id: string;
  title: string;
  category: string;
  duration: string;
  level: string;
  summary: string;
  body: string[];
  action: string;
};

export const LESSONS: Lesson[] = [
  {
    id: 'base-01', title: 'Descubra para onde seu dinheiro vai', category: 'Organização', duration: '4 min', level: 'Iniciante',
    summary: 'O primeiro passo para melhorar as finanças é ter uma visão confiável das entradas e saídas.',
    body: ['Registre receitas e despesas de maneira consistente. Você não precisa mudar todos os hábitos de uma vez; comece entendendo os padrões.', 'Revise os lançamentos por categoria e compare períodos equivalentes. Uma diferença pode ser sazonal e não necessariamente um problema.', 'Mantenha separado o saldo disponível, os valores previstos e o resultado do mês. Cada indicador responde a uma pergunta diferente.'],
    action: 'Registre as movimentações dos próximos sete dias.',
  },
  {
    id: 'base-02', title: 'Monte um orçamento que funcione', category: 'Orçamento', duration: '5 min', level: 'Iniciante',
    summary: 'Um bom orçamento ajuda você a decidir antes de gastar, sem exigir perfeição.',
    body: ['Comece com os valores reais de renda e os compromissos essenciais. Se sua renda varia, use um cenário conservador em vez do melhor mês.', 'Separe compromissos fixos, gastos variáveis e despesas ocasionais. Custos anuais também precisam de planejamento.', 'Revise o orçamento regularmente. Ajustá-lo quando a realidade muda é mais útil do que manter números que não cabem na sua vida.'],
    action: 'Crie limites para duas categorias relevantes.',
  },
  {
    id: 'base-03', title: 'Construa uma reserva aos poucos', category: 'Economia', duration: '5 min', level: 'Intermediário',
    summary: 'Uma reserva pode reduzir a necessidade de recorrer a crédito caro quando surge um imprevisto.',
    body: ['A reserva deve considerar suas despesas essenciais, a estabilidade da renda, pessoas que dependem de você e outras proteções disponíveis.', 'Comece com uma meta inicial viável e aumente aos poucos. Não deixe de pagar necessidades essenciais ou assumir dívida cara apenas para atingir uma meta de economia.', 'Antes de escolher onde manter o dinheiro, considere segurança, liquidez, custos e riscos. O conteúdo do GestVolt é educativo e não substitui uma avaliação individual.'],
    action: 'Defina uma primeira meta de reserva realista.',
  },
  {
    id: 'base-04', title: 'Enfrente as dívidas com clareza', category: 'Dívidas', duration: '6 min', level: 'Intermediário',
    summary: 'Organizar as dívidas ajuda a comparar alternativas e reduzir decisões tomadas sob pressão.',
    body: ['Liste saldo, taxa de juros, custo efetivo total, parcelas, atraso e condições disponíveis. Não compare apenas o valor da parcela.', 'As dívidas com custo mais alto costumam merecer atenção, mas riscos imediatos, garantias, serviços essenciais e condições de negociação também importam.', 'Antes de contratar uma nova operação para pagar uma dívida, verifique o custo total, taxas, prazo e se a parcela cabe no orçamento.'],
    action: 'Organize todas as dívidas registradas em uma única lista.',
  },
  {
    id: 'base-05', title: 'Entenda juros compostos', category: 'Investimentos', duration: '4 min', level: 'Intermediário',
    summary: 'Juros compostos calculam o rendimento sobre o principal e sobre os juros acumulados.',
    body: ['O resultado depende do valor inicial, aportes, taxa, frequência de capitalização, impostos, custos e prazo.', 'A mesma lógica pode aumentar rapidamente uma dívida cara. Por isso, é importante compreender o custo do crédito antes de assumir parcelas.', 'Uma simulação matemática não é promessa de rendimento. Taxas reais mudam e investimentos podem ter riscos, tributos e condições de resgate diferentes.'],
    action: 'Teste um cenário no simulador de juros compostos.',
  },
  {
    id: 'base-06', title: 'Separe suas finanças pessoais e do negócio', category: 'Pequenos negócios', duration: '5 min', level: 'Iniciante',
    summary: 'Separar as movimentações facilita descobrir o resultado real da empresa.',
    body: ['Use contas e categorias separadas para os recursos pessoais e empresariais. Evite tratar todo saldo da empresa como dinheiro disponível para uso pessoal.', 'Defina uma retirada compatível com a realidade do negócio e registre as transferências entre pessoa e empresa corretamente.', 'A separação melhora os relatórios gerenciais, mas não substitui controles contábeis e fiscais exigidos para o negócio.'],
    action: 'Cadastre contas separadas para as movimentações pessoais e empresariais.',
  },
  {
    id: 'base-07', title: 'Faturamento não é lucro', category: 'Pequenos negócios', duration: '5 min', level: 'Iniciante',
    summary: 'Vender bastante não garante que um negócio seja lucrativo ou tenha caixa suficiente.',
    body: ['O faturamento representa vendas registradas; lucro exige considerar custos, despesas, impostos e o critério contábil apropriado.', 'O fluxo de caixa mostra quando o dinheiro entra e sai. É possível ter vendas lucrativas a receber e, ao mesmo tempo, faltar dinheiro para pagar uma obrigação hoje.', 'Para calcular margens, registre custos e despesas relevantes e confirme com um profissional quais itens e critérios se aplicam à sua atividade.'],
    action: 'Revise custos e despesas de uma categoria do negócio.',
  },
  {
    id: 'base-08', title: 'Cuide do capital de giro', category: 'Pequenos negócios', duration: '6 min', level: 'Intermediário',
    summary: 'Capital de giro ajuda a financiar o intervalo entre pagar compromissos e receber dos clientes.',
    body: ['Compare prazos de fornecedores, vencimentos, estoque e recebimentos. O volume de vendas sozinho não revela se o caixa será suficiente.', 'Mantenha uma projeção realista de entradas e saídas e atualize-a quando pagamentos atrasarem ou surgirem despesas inesperadas.', 'Não trate uma projeção como garantia. Use cenários conservadores e avalie custos e riscos antes de buscar crédito.'],
    action: 'Revise os compromissos e recebimentos previstos para os próximos 30 dias.',
  },
  {
    id: 'base-09', title: 'Avalie uma compra parcelada', category: 'Planejamento', duration: '4 min', level: 'Iniciante',
    summary: 'A parcela isolada pode parecer pequena, mas várias parcelas juntas comprometem a renda futura.',
    body: ['Compare o preço total, juros, taxas, condições à vista e o efeito dos pagamentos nos próximos meses.', 'Inclua parcelas existentes e despesas essenciais na análise. Não assuma que uma renda futura incerta estará disponível.', 'Uma compra parcelada sem juros ainda compromete o orçamento futuro e pode reduzir sua flexibilidade financeira.'],
    action: 'Revise as parcelas futuras registradas no aplicativo.',
  },
  {
    id: 'base-10', title: 'Aprenda a reconhecer golpes financeiros', category: 'Segurança', duration: '4 min', level: 'Todos',
    summary: 'Promessas de retorno alto, rápido e garantido merecem desconfiança.',
    body: ['Desconfie de pressão para decidir imediatamente, pedidos de segredo, transferências para contas desconhecidas e garantias incompatíveis com o risco.', 'Verifique a identidade da instituição e as informações em fontes oficiais quando tiver conexão. O GestVolt offline não consegue confirmar a legitimidade atual de uma oferta.', 'Nunca compartilhe senhas, códigos de autenticação ou chaves privadas. Se houver dúvida, não transfira dinheiro até verificar por um canal independente.'],
    action: 'Leia novamente antes de aceitar qualquer oferta financeira urgente.',
  },
  {
    id: 'base-11', title: 'Defina um preço que cubra seus custos', category: 'Pequenos negócios', duration: '6 min', level: 'Intermediário',
    summary: 'Precificar exige olhar para custos, despesas, impostos, comissões e condições do mercado.',
    body: ['Liste os custos variáveis associados a cada venda e estime as despesas fixas relevantes. Diferencie margem de lucro, margem de contribuição e acréscimo sobre custo.', 'Considere taxas de meios de pagamento, devoluções, perdas, comissões e impostos aplicáveis. As regras variam por atividade e regime tributário.', 'Antes de mudar preços, teste diferentes cenários e valide premissas com um profissional quando necessário.'],
    action: 'Use o simulador de custos para testar um produto ou serviço.',
  },
  {
    id: 'base-12', title: 'Faça uma revisão financeira semanal', category: 'Hábitos', duration: '3 min', level: 'Todos',
    summary: 'Uma revisão breve ajuda a identificar vencimentos, erros e decisões que precisam de atenção.',
    body: ['Confira lançamentos recentes, contas a vencer, recebimentos pendentes e categorias que mudaram.', 'Compare o realizado com o planejamento e ajuste o orçamento se sua situação mudou.', 'Não transforme a revisão em punição. O objetivo é compreender e decidir melhor, não buscar números perfeitos.'],
    action: 'Escolha um dia da semana para revisar suas finanças.',
  },
];

export const DAILY_TIPS = [
  { title: 'Registre no momento', text: 'Anotar uma compra assim que possível diminui esquecimentos e torna os relatórios mais úteis.', category: 'Organização' },
  { title: 'Planeje despesas anuais', text: 'IPTU, matrícula, manutenção e presentes podem ser previsíveis mesmo quando não são mensais.', category: 'Planejamento' },
  { title: 'Compare o custo total', text: 'Ao comparar crédito, veja juros, tarifas, prazo e custo efetivo total, não apenas o tamanho da parcela.', category: 'Crédito' },
  { title: 'Revise assinaturas', text: 'Veja os serviços recorrentes registrados e decida quais ainda fazem sentido para você.', category: 'Economia' },
  { title: 'Separe caixa de lucro', text: 'No negócio, saldo bancário e lucro não são a mesma coisa. Analise custos, despesas e obrigações.', category: 'Negócios' },
  { title: 'Prefira metas viáveis', text: 'Uma contribuição pequena que cabe no orçamento costuma ser mais sustentável do que uma meta impossível.', category: 'Metas' },
  { title: 'Revise recebimentos', text: 'Para pequenos negócios, identificar recebimentos vencidos cedo ajuda a planejar o caixa.', category: 'Negócios' },
  { title: 'Proteja sua privacidade', text: 'Faça backups em local seguro e compartilhe relatórios financeiros somente quando necessário.', category: 'Segurança' },
  { title: 'Evite comparar meses diferentes', text: 'Considere sazonalidade e despesas extraordinárias antes de concluir que sua situação piorou.', category: 'Análise' },
  { title: 'Simule antes de decidir', text: 'Teste como uma compra recorrente ou uma nova parcela pode afetar os próximos meses.', category: 'Planejamento' },
];
