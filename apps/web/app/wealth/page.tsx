import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const allocation = [
  { label: 'Cash & Equivalents', value: 42, color: 'bg-primary' },
  { label: 'Public Equities', value: 33, color: 'bg-secondary' },
  { label: 'Fixed Income', value: 17, color: 'bg-chart-3' },
  { label: 'Alternatives', value: 8, color: 'bg-accent' },
];

export default function WealthPage() {
  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl lg:ml-64 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Wealth</p>
            <h1 className="text-xl font-semibold tracking-tight">Portfolio Intelligence</h1>
          </div>
          <Badge variant="secondary" className="rounded-full">
            As of today
          </Badge>
        </div>
      </header>

      <main className="grid gap-6 px-4 py-6 pb-28 lg:ml-64 lg:grid-cols-12 lg:px-8 lg:pb-8">
        <section className="space-y-6 lg:col-span-8">
          <Card className="overflow-hidden border-0 bg-linear-to-br from-primary to-chart-3 text-primary-foreground shadow-[0_24px_80px_-50px_rgba(58,47,52,0.7)]">
            <CardContent className="space-y-3 p-8">
              <p className="text-xs uppercase tracking-[0.18em] opacity-85">Total Invested Assets</p>
              <h2 className="text-4xl font-semibold tracking-tight">$824,390.16</h2>
              <p className="text-sm opacity-85">12-month return: +7.4% net of fees</p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-card/90 shadow-[0_20px_50px_-40px_rgba(58,47,52,0.55)]">
            <CardHeader>
              <CardTitle>Allocation Mix</CardTitle>
              <CardDescription>Current exposure by strategy bucket.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {allocation.map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-muted-foreground">{item.value}%</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6 lg:col-span-4">
          <Card className="border-0 bg-card/90 shadow-[0_20px_50px_-40px_rgba(58,47,52,0.55)]">
            <CardHeader>
              <CardTitle>Advisory Highlights</CardTitle>
              <CardDescription>Automated observations from recent trends.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl bg-secondary/25 p-3">
                <p className="font-medium">Rebalancing Opportunity</p>
                <p className="text-muted-foreground">Public equity drift exceeded target by 2.1%.</p>
              </div>
              <div className="rounded-xl bg-accent/35 p-3">
                <p className="font-medium">Liquidity Reserve</p>
                <p className="text-muted-foreground">Cash buffer covers 14.6 months of projected outflows.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-muted/55">
            <CardHeader>
              <CardTitle>Risk Pulse</CardTitle>
              <CardDescription>Current downside stress resilience score.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-border/40">
                <div className="h-full w-[76%] rounded-full bg-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Score 76/100: moderate, improving week over week.</p>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
