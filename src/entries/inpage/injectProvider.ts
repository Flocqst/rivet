import { getMessenger } from '~/messengers'
import { getProvider } from '~/provider'

const backgroundMessenger = getMessenger('background:inpage')

export function injectProvider() {
  console.log('injection complete in window')
  window.ethereum = getProvider({
    host: window.location.host,
    messenger: backgroundMessenger,
  })
  window.dispatchEvent(new Event('ethereum#initialized'))
}
