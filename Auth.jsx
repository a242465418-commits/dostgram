
import { useState } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        setMessage('Login successful! 🎉')
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        setMessage('Signup successful! Email inbox mein confirmation link check karo. 📩')
      }
    } catch (error) {
      setMessage(error.message || 'Kuchh error aaya. Dobara try karo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '40px auto', padding: 24, fontFamily: 'Arial', border: '1px solid #ddd', borderRadius: 16 }}>
      <h2>{isLogin ? 'Welcome back to DostGram' : 'Join DostGram'}</h2>
      <p>{isLogin ? 'Login to your account' : 'Create your free account'}</p>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: 12, marginBottom: 12, boxSizing: 'border-box' }}
        />

        <input
          type="password"
          placeholder="Password (minimum 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
          style={{ width: '100%', padding: 12, marginBottom: 12, boxSizing: 'border-box' }}
        />

        <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, cursor: 'pointer' }}>
          {loading ? 'Please wait...' : isLogin ? 'Login' : 'Sign up'}
        </button>
      </form>

      <p>{message}</p>

      <button onClick={() => { setIsLogin(!isLogin); setMessage('') }} style={{ padding: 10, cursor: 'pointer' }}>
        {isLogin ? 'Create a new account' : 'Already have an account? Login'}
      </button>
    </div>
  )
}
