import Web3 from 'web3'
import type { provider as Web3Provider, RequestArguments } from 'web3-core'
import { first } from 'lodash-unified'
import createMetaMaskProvider, { MetaMaskInpageProvider } from '@dimensiondev/metamask-extension-provider'
import { ChainId, ProviderType } from '@masknet/web3-shared-evm'
import { delay } from '@masknet/shared-base'
import { updateAccount } from '../../../../plugins/Wallet/services'
import { currentChainIdSettings, currentProviderSettings } from '../../../../plugins/Wallet/settings'
import { replaceRecentTransaction } from '../../../../plugins/Wallet/services/transaction/database'
import type { Provider } from '../types'
import type { JsonRpcPayload, JsonRpcResponse } from 'web3-core-helpers'

export class MetaMaskProvider implements Provider {
    private provider: MetaMaskInpageProvider | null = null
    private web3: Web3 | null = null

    async onMessage(message: {
        type: 'tx_replacement'
        data: {
            oldTx: string
            newTx: string
            nonce: string
            from: string
        }
    }) {
        if (message.type !== 'tx_replacement') return
        await replaceRecentTransaction(
            currentChainIdSettings.value,
            message.data.from,
            message.data.oldTx,
            message.data.newTx,
        )
    }

    async onAccountsChanged(accounts: string[]) {
        if (currentProviderSettings.value !== ProviderType.MetaMask) return
        await updateAccount({
            account: first(accounts),
            providerType: ProviderType.MetaMask,
            chainId:
                typeof this.provider?.chainId === 'string' ? Number.parseInt(this.provider.chainId, 16) : undefined,
        })
    }

    async onChainIdChanged(id: string) {
        if (currentProviderSettings.value !== ProviderType.MetaMask) return

        // learn more: https://docs.metamask.io/guide/ethereum-provider.html#chain-ids and https://chainid.network/
        const chainId = Number.parseInt(id, 16) || ChainId.Mainnet
        if (currentChainIdSettings.value === chainId) return
        await updateAccount({
            chainId,
        })
    }

    async createProvider(
        chainId?: ChainId,
        url?: string,
    ): Promise<{
        request: (requestArguments: RequestArguments) => Promise<any>
        send: (payload: JsonRpcPayload, callback: (error: Error | null, response?: JsonRpcResponse) => void) => void
    }> {
        // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
        if (this.provider && this.provider.chainId !== null) return this.provider
        this.provider = createMetaMaskProvider()

        // wait for building the connection
        await delay(1000)

        if (!this.provider || this.provider.chainId === null) {
            this.provider = null
            throw new Error('Unable to create provider.')
        }

        this.provider.on('accountsChanged', this.onAccountsChanged as (...args: unknown[]) => void)
        this.provider.on('chainChanged', this.onChainIdChanged as (...args: unknown[]) => void)
        this.provider.on('message', this.onMessage as (...args: unknown[]) => void)
        return this.provider
    }
    async createWeb3(chainId?: ChainId, keys?: string[], url?: string) {
        const provider_ = (await this.createProvider()) as Web3Provider
        if (!this.web3) this.web3 = new Web3(provider_)
        else this.web3.setProvider(provider_)
        return this.web3
    }
    async ensureConnectedAndUnlocked() {
        const web3 = await this.createWeb3()
        try {
            const accounts = await web3.eth.requestAccounts()
            throw accounts
        } catch (error: string[] | any) {
            const accounts = error
            if (Array.isArray(accounts)) {
                if (accounts.length === 0) throw new Error('MetaMask is locked or it has not connected any accounts.')
                else if (accounts.length > 0) return // valid
            }
            // Any other error means failed to connect MetaMask
            throw new Error('Failed to connect to MetaMask.')
        }
    }
    async requestAccounts() {
        const web3 = await this.createWeb3()
        const chainId = await web3.eth.getChainId()
        const accounts = await web3.eth.requestAccounts()
        return {
            chainId,
            accounts,
        }
    }
}
