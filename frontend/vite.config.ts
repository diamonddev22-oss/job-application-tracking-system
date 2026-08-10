import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 0.0.0.0 is a literal IPv4 address, not a hostname Node has to resolve - binding here (rather
    // than to the string "localhost") sidesteps a VPN (e.g. Astrill) that disables/blocks IPv6,
    // which otherwise makes "localhost" resolve to the now-unreachable IPv6 loopback (::1) first.
    // It also means this dev server accepts connections from any of this machine's network
    // interfaces, not just loopback - i.e. it's reachable both at http://127.0.0.1:5173 *and* at
    // this machine's LAN IP (e.g. http://192.168.1.23:5173) from another device on the same
    // network. See README.md's "LAN access" section for the rest of what that needs (backend bind
    // + CORS + Windows Firewall).
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
