import Web3 from 'web3'
import type { RequestArguments } from 'web3-core'
import type { JsonRpcPayload, JsonRpcResponse } from 'web3-core-helpers'
import { defer } from '@masknet/shared-base'
import { ChainId, EthereumMethodType } from '@masknet/web3-shared-evm'
import { EVM_Messages } from '../../../../plugins/EVM/messages'
import { resetAccount } from '../../../../plugins/Wallet/services'
import type { Provider } from '../types'

//#region redirect requests to the content page
let id = 0

async function request(requestArguments: RequestArguments) {
    id += 1
    const requestId = id
    const [deferred, resolve, reject] = defer<any, Error | null>()

    function onResponse({ payload, result, error }: EVM_Messages['FORTMATIC_PROVIDER_RPC_RESPONSE']) {
        if (payload.id !== requestId) return
        if (error) reject(error)
        else resolve(result)
    }

    setTimeout(
        () => reject(new Error('The request is timeout.')),
        requestArguments.method === EthereumMethodType.MASK_LOGIN_FORTMATIC ? 3 * 60 * 1000 : 45 * 1000,
    )
    EVM_Messages.events.FORTMATIC_PROVIDER_RPC_RESPONSE.on(onResponse)
    EVM_Messages.events.FORTMATIC_PROVIDER_RPC_REQUEST.sendToVisiblePages({
        payload: {
            jsonrpc: '2.0',
            id: requestId,
            params: [],
            ...requestArguments,
        },
    })

    deferred.finally(() => {
        EVM_Messages.events.FORTMATIC_PROVIDER_RPC_RESPONSE.off(onResponse)
    })

    return deferred
}

function send(payload: JsonRpcPayload, callback: (error: Error | null, response?: JsonRpcResponse) => void) {
    request({
        method: payload.method,
        params: payload.params,
    })
        .then((result) => {
            callback(null, {
                id: payload.id as number,
                jsonrpc: '2.0',
                result,
            })
        })
        .catch((error) => {
            callback(error)
        })
}
//#endregion

export class FortmaticProvider implements Provider {
    private web3: Web3 | null = null

    async createProvider() {
        return {
            request,
            send,
            sendAsync: send,
        }
    }
    async createWeb3() {
        if (this.web3) return this.web3
        this.web3 = new Web3(await this.createProvider())
        return this.web3
    }
    async requestAccounts(chainId?: ChainId) {
        if (!chainId) throw new Error('Please give a chain id.')
        const provider = await this.createProvider()
        return provider.request({
            method: EthereumMethodType.MASK_LOGIN_FORTMATIC,
            params: [chainId],
        })
    }
    async dismissAccounts(chainId?: ChainId) {
        if (!chainId) throw new Error('Please give a chain id.')
        const provider = await this.createProvider()
        await provider.request({
            method: EthereumMethodType.MASK_LOGOUT_FORTMATIC,
            params: [chainId],
        })
        resetAccount()
    }
}
