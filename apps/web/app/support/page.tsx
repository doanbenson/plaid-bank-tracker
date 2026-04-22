import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl lg:ml-64 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Support</p>
            <h1 className="text-xl font-semibold tracking-tight">Client Concierge</h1>
          </div>
          <Badge variant="secondary" className="rounded-full">
            Avg response 18 min
          </Badge>
        </div>
      </header>

      <main className="grid gap-6 px-4 py-6 pb-28 lg:ml-64 lg:grid-cols-12 lg:px-8 lg:pb-8">
        <section className="space-y-6 lg:col-span-7">
          <Card className="border-0 bg-card/90 shadow-[0_20px_50px_-40px_rgba(58,47,52,0.55)]">
            <CardHeader>
              <CardTitle>Open a Request</CardTitle>
              <CardDescription>Share your question and our team will follow up quickly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Subject" className="rounded-xl" />
              <textarea
                placeholder="Describe what you need help with"
                className="min-h-32 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none ring-ring/10 transition-shadow focus-visible:ring-[3px]"
              />
              <Button className="w-full sm:w-auto">Submit request</Button>
            </CardContent>
          </Card>

          <Card className="border-0 bg-muted/50">
            <CardHeader>
              <CardTitle>Security Assistance</CardTitle>
              <CardDescription>Immediate actions for access or account concerns.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-card/80 p-4">
                <p className="font-medium">Lock Account Access</p>
                <p className="mt-1 text-sm text-muted-foreground">Freeze access to all linked institutions instantly.</p>
              </div>
              <div className="rounded-xl bg-card/80 p-4">
                <p className="font-medium">Reset Credentials</p>
                <p className="mt-1 text-sm text-muted-foreground">Start a secure credential rotation workflow.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6 lg:col-span-5">
          <Card className="border-0 bg-card/90 shadow-[0_20px_50px_-40px_rgba(58,47,52,0.55)]">
            <CardHeader>
              <CardTitle>Popular Guides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border border-border/60 p-3">
                <p className="font-medium">Linking a new institution</p>
                <p className="text-muted-foreground">Step-by-step onboarding through Plaid Link.</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="font-medium">Understanding pending transactions</p>
                <p className="text-muted-foreground">How pending charges post and reconcile.</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="font-medium">Configuring alerts</p>
                <p className="text-muted-foreground">Set custom thresholds and notification channels.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-secondary/20">
            <CardHeader>
              <CardTitle>Live Advisor Window</CardTitle>
              <CardDescription>Monday to Friday, 8:00 AM to 8:00 PM PST.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full">Start secure chat</Button>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
