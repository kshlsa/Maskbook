import { first } from 'lodash-unified'
import type { JsonRpcPayload, JsonRpcResponse } from 'web3-core-helpers'
import WalletConnect from '@walletconnect/client'
import type { IJsonRpcRequest } from '@walletconnect/types'
import { ProviderType, ChainId } from '@masknet/web3-shared-evm'
import * as MaskWallet from './MaskWallet'
import { resetAccount, updateAccount } from '../../../../plugins/Wallet/services'
import { currentChainIdSettings, currentProviderSettings } from '../../../../plugins/Wallet/settings'
import type { Provider } from '../types'
import type types from 'web3'
import type { RequestArguments } from 'web3-core'

export class WalletConnectProvider implements Provider {
    private connector: WalletConnect | null = null

    /**
     * Create a new connector and destroy the previous one if exists
     */
    async createConnector() {
        if (this.connector?.connected) return this.connector

        // create a new connector
        this.connector = new WalletConnect({
            bridge: 'https://uniswap.bridge.walletconnect.org',
            clientMeta: {
                name: 'Mask Network',
                description: 'Mask Network',
                url: 'https://mask.io',
                icons: ['https://mask.io/apple-touch-icon.png'],
            },
        })
        this.connector.on('connect', this.onConnect)
        this.connector.on('session_update', this.onUpdate)
        this.connector.on('disconnect', this.onDisconnect)
        this.connector.on('error', this.onDisconnect)
        if (!this.connector.connected) await this.connector.createSession()
        return this.connector
    }

    async createConnectorIfNeeded() {
        if (this.connector) return this.connector
        return this.createConnector()
    }
    private onConnect() {
        this.onUpdate(null)
    }

    private async onUpdate(
        error: Error | null,
        payload?: {
            params: {
                chainId: number
                accounts: string[]
            }[]
        },
    ) {
        if (error) return
        if (!this.connector?.accounts.length) return
        if (currentProviderSettings.value !== ProviderType.WalletConnect) return
        await updateAccount({
            name: this.connector.peerMeta?.name,
            account: first(this.connector.accounts),
            chainId: this.connector.chainId,
            providerType: ProviderType.WalletConnect,
        })
    }

    private async onDisconnect(error: Error | null) {
        if (this.connector?.connected) await this.connector.killSession()
        this.connector = null
        if (currentProviderSettings.value !== ProviderType.WalletConnect) return
        await resetAccount({
            providerType: ProviderType.WalletConnect,
        })
    }

    createProvider(
        chainId?: ChainId,
        url?: string,
    ): Promise<{
        request: (requestArguments: RequestArguments) => Promise<any>
        send: (payload: JsonRpcPayload, callback: (error: Error | null, response?: JsonRpcResponse) => void) => void
    }> {
        throw new Error('Method not implemented.')
    }
    createWeb3(chainId?: ChainId, keys?: string[], url?: string): Promise<types> {
        return this.createWeb3({
            chainId,
        })
    }

    async requestAccounts() {
        const connector_ = await this.createConnectorIfNeeded()
        return new Promise<{ accounts: string[]; chainId: ChainId }>(async (resolve, reject) => {
            function resolve_() {
                resolve({
                    accounts: connector_.accounts,
                    chainId: connector_.chainId,
                })
            }
            if (connector_.accounts.length) {
                resolve_()
                return
            }
            connector_.on('connect', resolve_)
            connector_.on('update', resolve_)
            connector_.on('error', reject)
        })
    }

    async signPersonalMessage(data: string, address: string, password: string) {
        if (!this.connector) throw new Error('Connection Lost.')
        return (await this.connector.signPersonalMessage([data, address, password])) as string
    }

    async sendCustomRequest(payload: IJsonRpcRequest) {
        if (!this.connector) throw new Error('Connection Lost.')
        return (await this.connector.sendCustomRequest(payload as IJsonRpcRequest)) as JsonRpcResponse
    }
}
