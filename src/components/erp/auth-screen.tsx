'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calculator, Mail, Lock, User, Building2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [loading, setLoading] = React.useState(false)

  const login = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = form.get('email') as string
    const password = form.get('password') as string

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Welcome back, ${data.name}!`)
        onAuthed()
      } else {
        toast.error(data.error || 'Login failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const register = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = form.get('name') as string
    const email = form.get('email') as string
    const password = form.get('password') as string
    const organization = form.get('organization') as string

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, organization }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Account created! Welcome to AccountERP.')
        onAuthed()
      } else {
        toast.error(data.error || 'Registration failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const fillTestCreds = (email: string, password: string) => {
    const loginForm = document.getElementById('login-form') as HTMLFormElement
    if (loginForm) {
      (loginForm.querySelector('[name="email"]') as HTMLInputElement).value = email
      (loginForm.querySelector('[name="password"]') as HTMLInputElement).value = password
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-blue-50 p-4 dark:from-emerald-950/20 dark:via-background dark:to-blue-950/20">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg">
            <Calculator className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">AccountERP</h1>
          <p className="text-sm text-muted-foreground">UAE-Compliant Accounting & ERP Software</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-center">Welcome</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form id="login-form" onSubmit={login} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="login-email" name="email" type="email" required className="pl-9" placeholder="you@example.com" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="login-password" name="password" type="password" required className="pl-9" placeholder="••••••••" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : 'Sign In'}
                  </Button>
                </form>

                {/* Quick test login buttons */}
                <div className="mt-4 rounded-lg bg-muted/50 p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Quick Test Login:</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button onClick={() => fillTestCreds('admin@accounterp.com', 'Admin@123456')} className="text-left text-xs text-emerald-600 hover:underline">
                      🔑 Platform Admin: admin@accounterp.com
                    </button>
                    <button onClick={() => fillTestCreds('owner@techsolutions.ae', 'Owner@123456')} className="text-left text-xs text-blue-600 hover:underline">
                      🔑 Tenant Admin: owner@techsolutions.ae
                    </button>
                    <button onClick={() => fillTestCreds('accountant@techsolutions.ae', 'Account@123')} className="text-left text-xs text-purple-600 hover:underline">
                      🔑 Accountant: accountant@techsolutions.ae
                    </button>
                    <button onClick={() => fillTestCreds('viewer@techsolutions.ae', 'Viewer@123')} className="text-left text-xs text-gray-600 hover:underline">
                      🔑 Viewer: viewer@techsolutions.ae
                    </button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={register} className="space-y-4">
                  <div>
                    <Label htmlFor="reg-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="reg-name" name="name" required className="pl-9" placeholder="Ahmed Al Rashid" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reg-org">Organization Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="reg-org" name="organization" required className="pl-9" placeholder="My Company LLC" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reg-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="reg-email" name="email" type="email" required className="pl-9" placeholder="you@example.com" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reg-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="reg-password" name="password" type="password" required minLength={6} className="pl-9" placeholder="Min 6 characters" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...</> : 'Create Account'}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    14-day free trial. No credit card required.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          VAT Compliant • E-Invoicing Ready • Multi-Business • Multi-User
        </p>
      </div>
    </div>
  )
}
