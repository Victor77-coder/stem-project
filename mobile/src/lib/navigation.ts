import { router, type Href } from 'expo-router';

/**
 * Troca a pilha inteira pela tela de destino. Depois de criar a conta, entrar ou sair, o voltar (gesto do iOS,
 * botão do Android) não pode reabrir telas que já não valem, como a revisão de um cadastro já criado.
 * `replace` sozinho troca só a tela do topo: as etapas do cadastro continuavam embaixo.
 */
export function resetTo(href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
