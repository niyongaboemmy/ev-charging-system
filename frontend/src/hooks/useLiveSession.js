import { useState, useEffect } from 'react'
import client from '../api/client'

export function useLiveSession(chargerId, connector) {
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!chargerId || !connector) return
    const fetchData = () =>
      client
        .get(`/sessions/live/${chargerId}/${connector}`)
        .then((r) => setData(r.data))
        .catch(() => {})
    fetchData()
    const id = setInterval(fetchData, 30000)
    return () => clearInterval(id)
  }, [chargerId, connector])

  return data
}
