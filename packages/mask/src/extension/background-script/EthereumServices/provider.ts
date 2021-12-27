import { first } from 'lodash-unified'
import { defer } from '@masknet/shared-base'
import { ChainId, createLookupTableResolver, ProviderType } from '@masknet/web3-shared-evm'
import * as WalletConnect from './providers/WalletConnect'
import * as Injected from './providers/Injected'
import { MaskWalletProvider } from './providers/MaskWallet'
import { MetaMaskProvider } from './providers/MetaMask'
import { WalletConnectProvider } from './providers/WalletConnect'
import { CustomNetworkProvider } from './providers/CustomNetwork'
import { FortmaticProvider } from './providers/Fortmatic'
import type { Provider } from './types'
import { currentChainIdSettings, currentProviderSettings } from '../../../plugins/Wallet/settings'

const getProviderInternal = createLookupTableResolver<ProviderType, Provider | null>(
    {
        [ProviderType.MaskWallet]: new MaskWalletProvider(),
        [ProviderType.MetaMask]: new MetaMaskProvider(),
        [ProviderType.WalletConnect]: new WalletConnectProvider(),
        [ProviderType.CustomNetwork]: new CustomNetworkProvider(),
        [ProviderType.Coin98]: null,
        [ProviderType.WalletLink]: null,
        [ProviderType.MathWallet]: null,
        [ProviderType.Fortmatic]: new FortmaticProvider(),
    },
    null,
)

export function createWeb3(
    chainId = currentChainIdSettings.value,
    providerType = currentProviderSettings.value,
    keys: string[] = [],
) {
    const provider = getProviderInternal(providerType)
    return provider?.createWeb3(chainId, keys) ?? null
}

export function createProvider(chainId = currentChainIdSettings.value, providerType = currentProviderSettings.value) {
    const provider = getProviderInternal(providerType)
    return provider?.createProvider(chainId)
}

export async function connect(chainId = currentChainIdSettings.value, providerType = currentProviderSettings.value) {
    const provider = getProviderInternal(providerType)
    const { accounts = [] } = (await provider?.requestAccounts(chainId)) ?? {}
    return {
        account: first(accounts),
        chainId,
    }
}

export async function disconnect(chainId = currentChainIdSettings.value, providerType = currentProviderSettings.value) {
    const provider = getProviderInternal(providerType)
    await provider?.dismissAccounts?.(chainId)
}

//#region connect WalletConnect
// step 1:
// Generate the connection URI and render a QRCode for scanning by the user
export async function createConnectionURI() {
    return (await WalletConnect.createConnector()).uri
}

// step2:
// If user confirmed the request we will receive the 'connect' event
let resolveConnect: ((result: { account?: string; chainId: ChainId }) => void) | undefined
let rejectConnect: ((error: Error) => void) | undefined

export async function connectWalletConnect() {
    const [deferred, resolve, reject] = defer<{ account?: string; chainId: ChainId }>()

    resolveConnect = resolve
    rejectConnect = reject
    createWalletConnect().then(resolve, reject)

    return deferred
}

export async function createWalletConnect() {
    const connector = await WalletConnect.createConnectorIfNeeded()
    if (connector.connected)
        return {
            account: first(connector.accounts),
            chainId: connector.chainId,
        }

    const { accounts, chainId } = await WalletConnect.requestAccounts()
    return {
        account: first(accounts),
        chainId,
    }
}

export async function cancelWalletConnect() {
    rejectConnect?.(new Error('Failed to connect to WalletConnect.'))
}
//#endregion

//#region connect injected provider
export async function notifyEvent(providerType: ProviderType, name: string, event: unknown) {
    const provider = getProviderInternal(providerType)
    switch (name) {
        case 'accountsChanged':
            await provider?.onAccountsChanged?.(event as string[], providerType)
            break
        case 'chainChanged':
            await provider?.onChainIdChanged?.(event as string, providerType)
            break
        default:
            throw new Error(`Unknown event name: ${name}.`)
    }
}
//#endregion
