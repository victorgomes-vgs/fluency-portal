/**
 * Corporate Speech — Student Digital
 * Configuração do flipbook protegido
 *
 * COMO ALTERAR A SENHA:
 * 1. Mude BOOK_PASSWORD abaixo para a senha que os alunos vão digitar.
 * 2. Salve o arquivo e faça upload de novo no seu site.
 *
 * IMPORTANTE (hospedagem estática):
 * A senha fica no navegador do visitante. Isso impede a maioria dos alunos
 * de abrir o livro sem a senha (como no FlipHTML5 free/pro), mas NÃO é
 * criptografia forte. Quem souber inspecionar o código pode contornar.
 * Para proteção real de conteúdo pago, use login no servidor (WordPress,
 * Firebase Auth, etc.).
 */
window.FLIPBOOK_CONFIG = {
  /** Título exibido na barra e na tela de senha */
  title: 'Corporate Speech',
  subtitle: 'Student Digital Edition',
  brand: 'The Fluency Studio',

  /**
   * SENHA DE ACESSO — altere aqui
   * Exemplo: 'aluno2026' ou 'Fluency@CS1'
   */
  password: 'fluency2026',

  /** Manter sessão aberta neste navegador até fechar a aba */
  rememberSession: true,

  /** Chave interna do sessionStorage (não precisa mudar) */
  sessionKey: 'cs_student_digital_unlocked',

  /** Total de páginas (auto-detecta; deixe 0 para detectar) */
  totalPages: 0,

  /** Página inicial (1 = capa) */
  startPage: 1,

  /** Caminho do livro (arquivo gerado pelo pdf2htmlEX) */
  bookSrc: 'book.html',
};
