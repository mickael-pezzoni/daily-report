/**
 * Formes JSON échangées entre l'API et le web. Ce sont les shapes telles
 * qu'elles passent sur le fil — pas les types de lignes en base.
 */

/** Réponse de `GET /api/auth-state`. Public : appelé avant toute session. */
export interface AuthState {
  /**
   * Vrai dès qu'un compte existe sur cet espace. Le web s'en sert pour choisir
   * entre l'écran de connexion et l'écran de premier lancement ; l'API s'en
   * sert pour refuser toute inscription supplémentaire.
   */
  hasAccount: boolean
}

/** L'utilisateur connecté, tel que le renvoie `GET /api/me`. */
export interface SessionUser {
  id: string
  name: string
  email: string
}
