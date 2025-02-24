import { useMemo } from 'react'
import { omitBy } from 'remeda'
import {
  formatEther,
  formatGwei,
  formatTransaction,
  formatTransactionRequest,
  hexToString,
  isHex,
} from 'viem'

import { Container, LabelledContent, Tooltip } from '~/components'
import { Button, Column, Columns, Inline, Stack, Text } from '~/design-system'
import { usePendingBlockQueryOptions } from '~/hooks/usePendingBlock'
import { usePendingTransactionsQueryOptions } from '~/hooks/usePendingTransactions'
import {
  type UsePrepareTransactionRequestParameters,
  usePrepareTransactionRequest,
} from '~/hooks/usePrepareTransactionRequest'
import { useTxpoolQueryOptions } from '~/hooks/useTxpool'
import { getMessenger } from '~/messengers'
import type { RpcRequest } from '~/messengers/schema'
import { queryClient } from '~/react-query'
import { truncate } from '~/utils'
import { useAccountStore } from '~/zustand'

const backgroundMessenger = getMessenger('background:wallet')

export default function PendingRequest({ request }: { request: RpcRequest }) {
  if (request.method === 'eth_sendTransaction')
    return <SendTransactionRequest request={request} />
  if (request.method === 'personal_sign')
    return <SignMessageRequest request={request} />
  if (request.method === 'eth_signTypedData_v4')
    return <SignTypedDataRequest request={request} />
  return null
}

function PendingRequestContainer({
  children,
  isLoading,
  onApprove,
  onReject,
}: {
  children: React.ReactNode
  isLoading?: boolean
  onApprove(): void
  onReject(): void
}) {
  return (
    <Container
      header="Pending Request"
      footer={
        <Inline gap="12px" wrap={false}>
          <Button disabled={isLoading} onClick={onReject} variant="tint red">
            Reject
          </Button>
          <Button disabled={isLoading} onClick={onApprove} variant="tint green">
            Approve
          </Button>
        </Inline>
      }
    >
      <Stack gap="32px">{children}</Stack>
    </Container>
  )
}

////////////////////////////////////////////////////////////////////////
// Detail Components

const numberIntl = new Intl.NumberFormat()
const numberIntl8SigFigs = new Intl.NumberFormat('en-US', {
  maximumSignificantDigits: 8,
})

type ExtractRequest<Method extends string> = Extract<
  RpcRequest,
  { method: Method }
>

function SendTransactionRequest({
  request,
}: {
  request: ExtractRequest<'eth_sendTransaction'>
}) {
  // Format transaction request from RPC format (hex) into readable format (bigint, etc).
  const transactionRequest = useMemo(
    () => formatTransaction(request.params[0]),
    [request.params],
  )

  // Prepare the transaction request for signing (populate gas estimate, fees, etc if non-existent).
  const { account: account_ } = useAccountStore()
  const { data: preparedRequest, isLoading } = usePrepareTransactionRequest({
    ...transactionRequest,
    account: account_,
  } as unknown as UsePrepareTransactionRequestParameters)
  const {
    from,
    to,
    nonce,
    maxFeePerGas,
    maxPriorityFeePerGas,
    value,
    gas,
    data,
  } = preparedRequest || {}

  ////////////////////////////////////////////////////////////////////////

  const pendingBlockQueryOptions = usePendingBlockQueryOptions()
  const pendingTransactionsQueryOptions = usePendingTransactionsQueryOptions()
  const txpoolQueryOptions = useTxpoolQueryOptions()

  const handleApprove = async () => {
    if (!preparedRequest) return

    // Serialize the transaction request into RPC format (hex).
    const txRequest = formatTransactionRequest(preparedRequest)
    const params = [omitBy(txRequest, (value) => !isHex(value))]

    await backgroundMessenger.send('pendingRequest', {
      request: { ...request, params: params as any },
      status: 'approved',
    })

    // Invalidate resources that depend on pending transactions.
    queryClient.invalidateQueries(pendingBlockQueryOptions)
    queryClient.invalidateQueries(pendingTransactionsQueryOptions)
    queryClient.invalidateQueries(txpoolQueryOptions)
  }

  const handleReject = async () => {
    await backgroundMessenger.send('pendingRequest', {
      request,
      status: 'rejected',
    })
  }

  ////////////////////////////////////////////////////////////////////////

  return (
    <PendingRequestContainer
      isLoading={isLoading}
      onApprove={handleApprove}
      onReject={handleReject}
    >
      <Stack gap="20px">
        <Text size="14px">Send Transaction</Text>
        <Columns gap="12px">
          <Column width="1/3">
            <LabelledContent label="From">
              <Tooltip label={from}>
                <Text wrap={false} size="12px">
                  {from &&
                    truncate(from, {
                      start: 6,
                      end: 4,
                    })}
                </Text>
              </Tooltip>
            </LabelledContent>
          </Column>
          <Column width="1/3">
            <LabelledContent label="To">
              <Tooltip label={to}>
                <Text wrap={false} size="12px">
                  {to &&
                    truncate(to, {
                      start: 6,
                      end: 4,
                    })}
                </Text>
              </Tooltip>
            </LabelledContent>
          </Column>
          <Column width="1/3">
            <LabelledContent label="Value">
              <Text size="12px">
                {typeof value === 'bigint' &&
                  `${numberIntl8SigFigs.format(
                    Number(formatEther(value)),
                  )} ETH`}
              </Text>
            </LabelledContent>
          </Column>
        </Columns>
        <Columns gap="12px">
          <Column width="1/3">
            <LabelledContent label="Gas Limit">
              <Text size="12px">
                {typeof gas === 'bigint' && numberIntl.format(gas)}
              </Text>
            </LabelledContent>
          </Column>
          <Column width="1/3">
            <LabelledContent label="Tip Per Gas">
              <Text size="12px">
                {typeof maxPriorityFeePerGas === 'bigint' && (
                  <>
                    {numberIntl8SigFigs.format(
                      Number(formatGwei(maxPriorityFeePerGas)),
                    )}{' '}
                    <Text color="text/tertiary">gwei</Text>
                  </>
                )}
              </Text>
            </LabelledContent>
          </Column>
          <Column width="1/3">
            <LabelledContent label="Max Fee Per Gas">
              <Text size="12px">
                {typeof maxFeePerGas === 'bigint' && (
                  <>
                    {numberIntl8SigFigs.format(
                      Number(formatGwei(maxFeePerGas)),
                    )}{' '}
                    <Text color="text/tertiary">gwei</Text>
                  </>
                )}
              </Text>
            </LabelledContent>
          </Column>
        </Columns>
        <Columns gap="12px">
          <Column>
            <LabelledContent label="Nonce">
              <Text size="12px">{nonce}</Text>
            </LabelledContent>
          </Column>
        </Columns>
        <Columns gap="12px">
          {data && (
            <Column>
              <LabelledContent label="Data">
                <Text size="12px">{data}</Text>
              </LabelledContent>
            </Column>
          )}
        </Columns>
      </Stack>
    </PendingRequestContainer>
  )
}

function SignMessageRequest({
  request,
}: {
  request: ExtractRequest<'personal_sign'>
}) {
  const [data, address] = request.params

  const handleApprove = async () => {
    await backgroundMessenger.send('pendingRequest', {
      request,
      status: 'approved',
    })
  }

  const handleReject = async () => {
    await backgroundMessenger.send('pendingRequest', {
      request,
      status: 'rejected',
    })
  }

  return (
    <PendingRequestContainer onApprove={handleApprove} onReject={handleReject}>
      <Stack gap="20px">
        <Text size="14px">Sign Message</Text>
        <Columns gap="12px">
          <Column width="1/4">
            <LabelledContent label="Address">
              <Tooltip label={address}>
                <Text wrap={false} size="12px">
                  {truncate(address, {
                    start: 6,
                    end: 4,
                  })}
                </Text>
              </Tooltip>
            </LabelledContent>
          </Column>
        </Columns>
        <Columns gap="12px">
          <Column>
            <LabelledContent label="Message">
              <Text size="12px">{hexToString(data)}</Text>
            </LabelledContent>
          </Column>
        </Columns>
      </Stack>
    </PendingRequestContainer>
  )
}

function SignTypedDataRequest({
  request,
}: {
  request: ExtractRequest<'eth_signTypedData_v4'>
}) {
  const [address, data] = request.params

  const handleApprove = async () => {
    await backgroundMessenger.send('pendingRequest', {
      request,
      status: 'approved',
    })
  }

  const handleReject = async () => {
    await backgroundMessenger.send('pendingRequest', {
      request,
      status: 'rejected',
    })
  }

  return (
    <PendingRequestContainer onApprove={handleApprove} onReject={handleReject}>
      <Stack gap="20px">
        <Text size="14px">Sign Data</Text>
        <Columns gap="12px">
          <Column width="1/4">
            <LabelledContent label="Address">
              <Tooltip label={address}>
                <Text wrap={false} size="12px">
                  {truncate(address, {
                    start: 6,
                    end: 4,
                  })}
                </Text>
              </Tooltip>
            </LabelledContent>
          </Column>
        </Columns>
        <Columns gap="12px">
          <Column>
            <LabelledContent label="Message">
              <Text as="pre" size="12px">
                {JSON.stringify(JSON.parse(data), null, 2)}
              </Text>
            </LabelledContent>
          </Column>
        </Columns>
      </Stack>
    </PendingRequestContainer>
  )
}
