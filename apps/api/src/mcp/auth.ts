import { OAuthError, OAuthErrorCode, type OAuthTokenVerifier } from '@modelcontextprotocol/server'
import { auth } from '../auth.js'

/**
 * Verifies an MCP Bearer token against the OAuth rail set up in `auth.ts`
 * (better-auth's `mcp` plugin). `AuthInfo` has no field for app-specific
 * identity, so the resolved account travels in `extra.userId` — that's how
 * it reaches `mcp/server.ts`'s per-request factory.
 */
export const mcpTokenVerifier: OAuthTokenVerifier = {
  async verifyAccessToken(token) {
    const session = await auth.api.getMcpSession({
      headers: new Headers({ Authorization: `Bearer ${token}` }),
    })
    if (!session) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'invalid or expired access token')
    }

    return {
      token: session.accessToken,
      clientId: session.clientId,
      scopes: session.scopes.split(' ').filter(Boolean),
      expiresAt: Math.floor(session.accessTokenExpiresAt.getTime() / 1000),
      extra: { userId: session.userId },
    }
  },
}
