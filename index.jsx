import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Coins, Server, LogIn, LogOut, Play, Pause, Archive } from "lucide-react"

// Simple AMP API helper
async function ampPost(baseUrl, path, sessionToken, parameters = {}) {
  const url = `${baseUrl.replace(/\/$/, '')}/API/${path}`
  const body = JSON.stringify({ parameters })
  const headers = { 'Content-Type': 'application/json' }
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`
  const res = await fetch(url, { method: 'POST', headers, body })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export default function BioSyncStudios() {
  const [adsWatched, setAdsWatched] = useState(0)
  const [tokens, setTokens] = useState(0)
  const [progress, setProgress] = useState(0)
  const [activeTab, setActiveTab] = useState('earn')

  // AMP / Dashboard state
  const [ampBase, setAmpBase] = useState('http://localhost:8080')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setProgress((adsWatched % 25) * 4)
    if (adsWatched > 0 && adsWatched % 25 === 0) {
      setTokens(prev => prev + 5)
    }
  }, [adsWatched])

  // AMP: Login via Core/Login -> returns sessionID
  const handleLogin = async () => {
    try {
      setLoading(true)
      const payload = { username, password }
      const res = await ampPost(ampBase, 'Core/Login', null, payload)
      if (!res || !res.sessionID) throw new Error(res.error || 'Login failed')
      setSessionId(res.sessionID)
      setLoggedIn(true)
      // fetch servers after login
      await fetchServers(res.sessionID)
    } catch (err) {
      console.error(err)
      alert('AMP login failed: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setSessionId('')
    setLoggedIn(false)
    setServers([])
  }

  // ADS/GetInstances
  const fetchServers = async (token) => {
    try {
      setLoading(true)
      const res = await ampPost(ampBase, 'ADS/GetInstances', token, {})
      // many AMP wrappers return data inside a property - prefer flexible parsing
      const instances = res.instances || res.Instances || res || []
      // normalize
      const list = Array.isArray(instances) ? instances.map(i => ({
        id: i.id || i.instanceId || i.InstanceId || i.guid || i.ID,
        name: i.friendlyName || i.name || i.FriendlyName || i.Friendly,
        type: i.type || i.Type,
        status: (i.state || i.status || 'unknown')
      })) : []
      setServers(list)
    } catch (err) {
      console.error(err)
      alert('Failed to fetch instances: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  const refreshInstanceStatus = async (instanceId) => {
    try {
      const res = await ampPost(ampBase, 'Instance/GetStatus', sessionId, { instanceId })
      // try to extract a status string
      const status = (res.status || res.State || JSON.stringify(res)).toString()
      setServers(prev => prev.map(s => s.id === instanceId ? { ...s, status } : s))
    } catch (err) {
      console.error(err)
      alert('Could not retrieve instance status.')
    }
  }

  const startInstance = async (instanceId) => {
    try {
      await ampPost(ampBase, 'Instance/Start', sessionId, { instanceId })
      await refreshInstanceStatus(instanceId)
    } catch (err) {
      console.error(err)
      alert('Failed to start instance.')
    }
  }

  const stopInstance = async (instanceId) => {
    try {
      await ampPost(ampBase, 'Instance/Stop', sessionId, { instanceId })
      await refreshInstanceStatus(instanceId)
    } catch (err) {
      console.error(err)
      alert('Failed to stop instance.')
    }
  }

  const takeBackup = async (instanceId) => {
    try {
      const name = `manual-backup-${new Date().toISOString()}`
      const res = await ampPost(ampBase, 'Instance/TakeBackup', sessionId, { instanceId, name, description: 'Created via BioSync UI' })
      if (res && res.backupId) {
        alert('Backup created: ' + res.backupId)
      } else {
        alert('Backup API responded. Check AMP for details.')
      }
    } catch (err) {
      console.error(err)
      alert('Backup failed: ' + (err.message || err))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-4xl shadow-2xl bg-white/70 backdrop-blur-md rounded-2xl border-0">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <img src="/mnt/data/Biosync.jpg" alt="BioSync Studios Logo" className="w-28 h-28 rounded-full shadow-lg mb-4" />
            <h1 className="text-3xl font-bold text-purple-700">BioSync Studios</h1>
            <p className="text-gray-600">Earn tokens, host servers, and manage your world.</p>
          </div>

          <Tabs defaultValue="earn" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="earn">Earn Tokens</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            </TabsList>

            {/* Token Earning Tab */}
            <TabsContent value="earn">
              <div className="w-full bg-gray-100 p-4 rounded-xl mb-6">
                <h2 className="text-xl font-semibold mb-2">Watch Ads to Earn Tokens</h2>
                <Progress value={progress} className="h-3 mb-3" />
                <p className="text-sm text-gray-500 mb-2">{adsWatched % 25}/25 ads watched</p>
                <div className="flex items-center justify-center gap-2 text-lg font-bold text-yellow-600">
                  <Coins className="w-5 h-5" /> {tokens} Tokens Earned
                </div>
              </div>

              <div className="w-full mb-4">
                <div className="rounded-xl overflow-hidden border border-gray-300">
                  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8422006697925257" crossorigin="anonymous"></script>
                  <ins className="adsbygoogle" style={{display:'block'}} data-ad-client="ca-pub-8422006697925257" data-ad-slot="1234567890" data-ad-format="auto" data-full-width-responsive="true"></ins>
                  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
                </div>
              </div>

              <Button onClick={() => setAdsWatched(adsWatched + 1)} className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-xl transition">Mark Ad as Watched</Button>
            </TabsContent>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard">
              {!loggedIn ? (
                <div className="flex flex-col items-center space-y-3">
                  <Server className="w-12 h-12 text-purple-600" />
                  <h2 className="text-xl font-semibold">Login to AMP</h2>

                  <div className="w-full grid grid-cols-2 gap-3">
                    <Input placeholder="AMP Base URL (http://host:port)" value={ampBase} onChange={e => setAmpBase(e.target.value)} />
                    <div className="flex items-center text-sm text-gray-500">Provide your AMP panel URL so the dashboard can call its API. A server-side proxy is recommended for production to avoid CORS and exposing credentials.</div>
                  </div>

                  <Input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
                  <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />

                  <div className="flex gap-2">
                    <Button onClick={handleLogin} disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-xl flex items-center gap-2">
                      <LogIn className="w-4 h-4" /> {loading ? 'Logging in...' : 'Login'}
                    </Button>
                    <Button onClick={() => { setUsername(''); setPassword('') }} variant="ghost" className="px-6 py-2">Clear</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold mb-0 flex items-center gap-2"><Server className="w-5 h-5" /> Your Servers</h2>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => fetchServers(sessionId)} className="px-4 py-2">Refresh</Button>
                      <Button onClick={handleLogout} className="px-4 py-2 bg-red-50"> <LogOut className="w-4 h-4" /> Logout</Button>
                    </div>
                  </div>

                  {loading ? (
                    <p>Loading servers...</p>
                  ) : servers.length === 0 ? (
                    <p className="text-gray-500">No servers found.</p>
                  ) : (
                    <ul className="space-y-3">
                      {servers.map((srv, i) => (
                        <li key={srv.id || i} className="p-3 bg-gray-100 rounded-xl shadow-sm text-left">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{srv.name || 'Unnamed'}</p>
                              <p className="text-sm text-gray-500">Type: {srv.type || 'unknown'}</p>
                              <p className="text-sm text-gray-500">Status: {srv.status || 'unknown'}</p>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button onClick={() => startInstance(srv.id)} title="Start" className="px-3 py-2"><Play className="w-4 h-4" /></Button>
                              <Button onClick={() => stopInstance(srv.id)} title="Stop" className="px-3 py-2"><Pause className="w-4 h-4" /></Button>
                              <Button onClick={() => takeBackup(srv.id)} title="Backup" className="px-3 py-2"><Archive className="w-4 h-4" /></Button>
                              <Button onClick={() => refreshInstanceStatus(srv.id)} title="Refresh" className="px-3 py-2">Refresh</Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <footer className="mt-8 text-gray-500 text-sm">© 2025 BioSync Studios — All Rights Reserved.</footer>
    </div>
  )
}
