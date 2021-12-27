import type Web3 from 'web3'
import type { RequestArguments } from 'web3-core'
import type { JsonRpcPayload, JsonRpcResponse } from 'web3-core-helpers'
import type { ChainId, ProviderType } from '@masknet/web3-shared-evm'

export interface Provider {
    createProvider(
        chainId?: ChainId,
        url?: string,
    ): Promise<{
        request: (requestArguments: RequestArguments) => Promise<any>
        send: (payload: JsonRpcPayload, callback: (error: Error | null, response?: JsonRpcResponse) => void) => void
    }>
    createWeb3(chainId?: ChainId, keys?: string[], url?: string): Promise<Web3>
    requestAccounts?(chainId?: ChainId): Promise<{
        chainId: ChainId
        accounts: string[]
    }>
    dismissAccounts?(chainId?: ChainId): Promise<void>
    ensureConnectedAndUnlocked?(): Promise<void>

    onAccountsChanged?(accounts: string[], providerType: ProviderType): Promise<void>
    onChainIdChanged?(id: string, providerType: ProviderType): Promise<void>
}

export interface Interceptor {
    encode?(payload: JsonRpcPayload): JsonRpcPayload
    decode?(error: Error | null, response?: JsonRpcResponse): [Error | null, JsonRpcResponse]
}
